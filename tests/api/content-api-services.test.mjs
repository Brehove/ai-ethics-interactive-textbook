import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ApiError, ConflictError, MEDIA_UPLOAD_POLICY, OPERATION_PAYLOAD_SCHEMAS, PROVIDER_REGISTRY, applySemanticOperation, assertCas, assertMediaBudget, checkpointDraft, checkpointExcerpt, deterministicId, finalizeChapterRevision, hmacSha256, resolveIdempotency, resolveProviderUrl, semanticDiffChapter, sha256, sha256Bytes, stableStringify, trustedIdentity, validateChapter, validateMediaReviewPackage, validatePrivateOriginal, validateUploadRequest, verifyHmacSignature } from '../../workers/content-api/src/services.mjs';
import worker, { releaseMediaKind } from '../../workers/content-api/src/index.mjs';

test('health endpoint is dependency-free and reports binding presence', async () => {
  const response = await worker.fetch(new Request('https://content.example/health'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'content-api', db_configured: false, media_configured: false });
});

test('authenticated managed-media preview streams only the exact cleared immutable image derivative', async () => {
  const bytes = new TextEncoder().encode('cleared-image-preview');
  const objectHash = await sha256Bytes(bytes);
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM media_assets a JOIN media_asset_versions v') && sql.includes('media_version_objects o')) return {
      media_id: 'media_aquinas', media_state: 'ready', media_version_id: 'version_aquinas_1', detected_mime: 'image/jpeg',
      rights_case_id: 'rights_aquinas_1', rights_status: 'cleared', review_package_state: 'cleared',
      role: 'derivative', object_key: 'media/aquinas/derivative.webp', object_sha256: objectHash, object_bytes: bytes.byteLength, content_type: 'image/webp'
    };
    return null;
  });
  const CONTENT_MEDIA = { get: async (key) => key === 'media/aquinas/derivative.webp' ? { size: bytes.byteLength, customMetadata: { sha256: objectHash }, arrayBuffer: async () => bytes.buffer } : null };
  const response = await worker.fetch(new Request('https://content.example/v1/media/media_aquinas/versions/version_aquinas_1/rights/rights_aquinas_1:preview', { headers: gatewayHeaders('media:read') }), { CONTENT_DB, CONTENT_MEDIA });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-sha256'), objectHash);
  assert.equal(await response.text(), 'cleared-image-preview');

  const denied = await worker.fetch(new Request('https://content.example/v1/media/media_aquinas/versions/version_aquinas_1/rights/rights_aquinas_1:preview', { headers: gatewayHeaders('content:read') }), { CONTENT_DB: fakeDb(() => null), CONTENT_MEDIA });
  assert.equal(denied.status, 404);
  assert.equal((await denied.json()).error.code, 'MEDIA_PREVIEW_NOT_AVAILABLE');
});

test('release workflow can fetch only an exact hash-verified submitted snapshot', async () => {
  const raw = '{"ok":true}';
  const snapshotHash = await sha256(raw);
  const headers = { 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_release_workflow', 'x-content-actor-type': 'service', 'x-content-client-id': 'github-content-release', 'x-content-scopes': 'content:releaseSnapshot' };
  const CONTENT_SNAPSHOTS = { get: async (key) => key === `submitted/${snapshotHash}.json` ? { arrayBuffer: async () => new TextEncoder().encode(raw).buffer } : null };
  const CONTENT_DB = { prepare: () => ({ bind: (hash) => ({ first: async () => hash === snapshotHash ? { r2_object_key: `submitted/${snapshotHash}.json`, snapshot_revision: 'snapshotrev-approved-1' } : null }) }) };
  const response = await worker.fetch(new Request(`https://content.example/v1/release-snapshots/${snapshotHash}`, { headers }), { CONTENT_DB, CONTENT_SNAPSHOTS });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-sha256'), snapshotHash);
  assert.equal(response.headers.get('x-content-snapshot-revision'), 'snapshotrev-approved-1');
  assert.equal(await response.text(), raw);
  const denied = await worker.fetch(new Request(`https://content.example/v1/release-snapshots/${snapshotHash}`, { headers: { ...headers, 'x-content-scopes': 'content:read' } }), { CONTENT_SNAPSHOTS });
  assert.equal(denied.status, 403);
  const tampered = await worker.fetch(new Request(`https://content.example/v1/release-snapshots/${snapshotHash}`, { headers }), { CONTENT_DB, CONTENT_SNAPSHOTS: { get: async () => ({ arrayBuffer: async () => new TextEncoder().encode('{"ok":false}').buffer }) } });
  assert.equal(tampered.status, 500);
  assert.equal((await tampered.json()).error.code, 'SNAPSHOT_HASH_MISMATCH');
  const unapproved = await worker.fetch(new Request(`https://content.example/v1/release-snapshots/${'b'.repeat(64)}`, { headers }), { CONTENT_DB, CONTENT_SNAPSHOTS });
  assert.equal(unapproved.status, 403);
  assert.equal((await unapproved.json()).error.code, 'RELEASE_APPROVAL_REQUIRED');
});

const gatewayHeaders = (scopes) => ({
  'content-type': 'application/json',
  'x-content-gateway-verified': 'v1',
  'x-content-actor-id': 'actor_reviewer_1',
  'x-content-actor-type': 'human',
  'x-content-client-id': 'studio',
  'x-content-run-id': 'run-review-1',
  'x-content-scopes': scopes
});

const agentHeaders = () => ({ 'content-type': 'application/json', authorization: 'Bearer test-agent-capability' });
const withAgentCapability = (env = {}, { actorId = 'actor_agent_1', clientId = 'mcp', runId = 'run-1', scopes = [], allowedDocumentIds = ['chapter_ch07', 'chapter_ch08'], allowedOperations = [] } = {}) => ({
  ...env,
  AUTH_CAPABILITY: { verifyCapability: async (token) => {
    assert.equal(token, 'test-agent-capability');
    return { actorId, actorType: 'agent', clientId, runId, scopes, allowedDocumentIds, allowedOperations, jti: 'cap_test' };
  } },
});

const fakeDb = (resolve) => {
  const statements = [];
  return {
    statements, batches: [],
    prepare(sql) {
      const statement = {
        sql, args: [],
        bind(...args) { this.args = args; return this; },
        async first() { return resolve(sql, this.args, 'first'); },
        async all() { return resolve(sql, this.args, 'all') || { results: [] }; }
      };
      statements.push(statement);
      return statement;
    },
    async batch(items) {
      this.batchItems = items; this.batches.push(items);
      return items.map((item) => {
        const resolved = resolve(item.sql, item.args, 'batch');
        if (resolved) return resolved;
        if (item.sql.includes('INSERT INTO api_rate_limits')) return { results: [{ request_count: 1 }], meta: { changes: 1 } };
        return { meta: { changes: 1 } };
      });
    }
  };
};

test('resume returns only an open draft based on the current canonical revision', async () => {
  const canonical = baseChapter();
  canonical.revisionId = 'revision_current';
  canonical.chapterVersion = 'revision_current';
  const CONTENT_DB = fakeDb((sql, args) => {
    if (sql.includes('FROM authority_registry WHERE document_id')) return { authority: 'd1' };
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM documents d JOIN document_revisions r')) return { id: 'chapter_ch07', current_revision_id: 'revision_current', content_hash: 'canonical-hash', content_text: JSON.stringify(canonical), r2_object_key: null, metadata_json: '{}' };
    if (sql.includes('SELECT c.id, c.state, c.created_at')) {
      assert.match(sql, /c\.state = 'open'/);
      assert.match(sql, /w\.base_revision_id = \?/);
      assert.deepEqual(args, ['actor_reviewer_1', 'chapter_ch07', 'revision_current']);
      return { id: 'cs_current', state: 'open', created_at: '2026-08-04T00:00:00Z', base_revision_id: 'revision_current', version: 1, content_hash: 'canonical-hash', content_text: JSON.stringify(canonical) };
    }
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter_ch07/changesets', {
    method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ title: 'Edit Chapter 7', resume: true, idempotencyKey: 'fresh-editor-load-key' })
  }), { CONTENT_DB });
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json();
  assert.equal(body.resumed, true);
  assert.equal(body.baseRevisionId, 'revision_current');
});

test('changeset read restores immutable submitted identity and recorded release decision after reload', async () => {
  const snapshotHash = 'a'.repeat(64);
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.startsWith('SELECT * FROM changesets')) return { id: 'cs-1', state: 'approved', title: 'Chapter 7 review' };
    if (sql.includes('FROM working_documents')) return { results: [{ id: 'wd-1', document_id: 'chapter_ch07', base_revision_id: 'revision-base', content_hash: 'content-hash', content_text: JSON.stringify(baseChapter()), metadata_json: '{}', checkpoint: 2, version: 3, updated_at: '2026-08-03T00:00:00Z' }] };
    if (sql.includes('FROM submitted_snapshots')) return { id: 'snapshot-1', snapshot_hash: snapshotHash, snapshot_revision: 'snapshotrev-1', document_count: 1, created_at: '2026-08-03T00:01:00Z' };
    if (sql.includes('FROM approvals')) return { id: 'approval-1', decision: 'approved', decision_kind: 'release', comment: 'Reviewed exact snapshot.', decided_by: 'actor_reviewer_1', decided_at: '2026-08-03T00:02:00Z' };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-1', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.submittedSnapshot, { snapshotId: 'snapshot-1', snapshotHash, snapshotRevision: 'snapshotrev-1', documentCount: 1, submittedAt: '2026-08-03T00:01:00Z' });
  assert.equal(body.releaseDecision.decision, 'approved');
  assert.equal(body.releaseDecision.comment, 'Reviewed exact snapshot.');
  assert.equal(body.documents[0].content.chapterId, 'chapter-07');
  assert.equal('content_text' in body.documents[0], false);
  const approvalRead = CONTENT_DB.statements.find((item) => item.sql.includes('FROM approvals'));
  assert.match(approvalRead.sql, /created_at AS decided_at/);
  assert.match(approvalRead.sql, /ORDER BY created_at DESC/);
});

test('changeset diff endpoint returns a structured content-free comparison tied to both hashes', async () => {
  const base = baseChapter();
  const working = structuredClone(base);
  working.body[1].text = 'Changed prose';
  const CONTENT_DB = fakeDb((sql) => sql.includes('FROM changesets c JOIN working_documents') ? { results: [{
    state: 'open', document_id: 'chapter-07', base_revision_id: 'revision-base', content_hash: 'working-hash', content_text: JSON.stringify(working), version: 2,
    base_content_hash: 'base-hash', base_content_text: JSON.stringify(base)
  }] } : null);
  const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-1:diff', { method: 'POST', headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.baseContentHash, 'base-hash');
  assert.equal(body.workingContentHash, 'working-hash');
  assert.deepEqual(body.diff.blocks.modified, [{ blockId: 'b-work', beforeType: 'paragraph', afterType: 'paragraph', changedFields: ['text'] }]);
  assert.equal(JSON.stringify(body).includes('Changed prose'), false);
});

test('multi-document changesets create isolated working copies in one batch', async () => {
  const chapters = { chapter_ch07: { ...baseChapter(), chapterId: 'chapter_ch07' }, chapter_ch08: { ...baseChapter(), chapterId: 'chapter_ch08' } };
  const CONTENT_DB = fakeDb((sql, args) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('SELECT authority FROM authority_registry')) return { authority: 'd1' };
    if (sql.includes('FROM documents d JOIN document_revisions')) return { id: args[0], current_revision_id: `revision-${args[0]}`, content_hash: `${args[0]}-hash`, content_text: JSON.stringify(chapters[args[0]]), r2_object_key: null, metadata_json: '{}' };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/changesets', { method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ title: 'Cross-chapter terminology repair', targets: ['chapter_ch08', 'chapter_ch07'], idempotencyKey: '019fc57c-899f-7c32-b1bb-4ca8fc34b887' }) }), { CONTENT_DB });
  const text = await response.text(); assert.equal(response.status, 201, text); const body = JSON.parse(text);
  assert.deepEqual(body.documents.map((item) => item.documentId), ['chapter_ch07', 'chapter_ch08']);
  const workingInserts = CONTENT_DB.batchItems.filter((item) => item.sql.includes('INSERT INTO working_documents'));
  assert.equal(workingInserts.length, 2);
  assert.deepEqual(workingInserts.map((item) => item.args[2]), ['chapter_ch07', 'chapter_ch08']);
});

test('service-only cutover proposals snapshot Git chapters without opening an edit lane', async () => {
  const canonical = { id: 'chapter_ch08', current_revision_id: 'revision-git-8', content_hash: '8'.repeat(64), content_text: JSON.stringify(baseChapter()), r2_object_key: null, metadata_json: '{}' };
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql === 'SELECT authority FROM authority_registry WHERE document_id = ? AND active = 1') return { authority: 'git' };
    if (sql.includes('FROM documents d JOIN document_revisions')) return canonical;
    return null;
  });
  const headers = { 'content-type': 'application/json', 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_release_workflow', 'x-content-actor-type': 'service', 'x-content-client-id': 'github-content-release', 'x-content-run-id': '123456', 'x-content-scopes': 'content:authority' };
  const response = await worker.fetch(new Request('https://content.example/v1/authority:prepareCutover', { method: 'POST', headers, body: JSON.stringify({ title: 'Prepare Chapter 8 cutover', targets: ['chapter_ch08'], idempotencyKey: 'prepare-cutover-8' }) }), { CONTENT_DB });
  const text = await response.text(); assert.equal(response.status, 201, text); const body = JSON.parse(text);
  assert.equal(body.purpose, 'authority_cutover'); assert.equal(body.readOnly, true);
  const changesetInsert = CONTENT_DB.batchItems.find((item) => item.sql.includes('INSERT INTO changesets'));
  assert.match(changesetInsert.sql, /purpose/); assert.equal(changesetInsert.args.at(-1), 'authority_cutover');
  const agent = await worker.fetch(new Request('https://content.example/v1/authority:prepareCutover', { method: 'POST', headers: agentHeaders(), body: JSON.stringify({ title: 'No', targets: ['chapter_ch08'], idempotencyKey: 'prepare-cutover-agent' }) }), withAgentCapability({ CONTENT_DB }, { scopes: ['content:authority'] }));
  assert.equal(agent.status, 403);

  const readOnlyDb = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('SELECT w.*, c.state')) return { results: [{ id: 'working-cutover', document_id: 'chapter_ch08', base_revision_id: 'revision-git-8', content_hash: canonical.content_hash, content_text: canonical.content_text, version: 1, state: 'open', purpose: 'authority_cutover', current_revision_id: 'revision-git-8', current_content_hash: canonical.content_hash }] };
    return null;
  });
  const edit = await worker.fetch(new Request('https://content.example/v1/changesets/cutover-8:apply', { method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ documentId: 'chapter_ch08', baseRevisionId: 'revision-git-8', expectedVersion: 1, idempotencyKey: 'cutover-edit-denied', operation: { type: 'text.replace', blockId: 'b-work', text: 'Not allowed.' } }) }), { CONTENT_DB: readOnlyDb });
  assert.equal(edit.status, 409); assert.equal((await edit.json()).error.code, 'CUTOVER_PROPOSAL_READ_ONLY');
});

test('multi-document edits require and honor an exact document target', async () => {
  const chapterA = baseChapter(); const chapterB = baseChapter();
  const workingRows = [
    { id: 'working-a', document_id: 'chapter_ch07', base_revision_id: 'revision-a', content_hash: 'hash-a', content_text: JSON.stringify(chapterA), version: 1, state: 'open', current_revision_id: 'revision-a' },
    { id: 'working-b', document_id: 'chapter_ch08', base_revision_id: 'revision-b', content_hash: 'hash-b', content_text: JSON.stringify(chapterB), version: 3, state: 'open', current_revision_id: 'revision-b' }
  ];
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('SELECT w.*, c.state')) return { results: workingRows };
    return null;
  });
  const operation = { type: 'text.replace', blockId: 'b-work', text: 'Only chapter eight changes.' };
  let response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-multi:apply', { method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ baseRevisionId: 'revision-b', expectedVersion: 3, idempotencyKey: 'multi-apply-key-1', operation }) }), { CONTENT_DB });
  assert.equal(response.status, 422); assert.equal((await response.json()).error.code, 'DOCUMENT_TARGET_REQUIRED');
  response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-multi:apply', { method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ documentId: 'chapter_ch08', baseRevisionId: 'revision-b', expectedVersion: 3, idempotencyKey: 'multi-apply-key-2', operation }) }), { CONTENT_DB });
  const text = await response.text(); assert.equal(response.status, 200, text); const body = JSON.parse(text);
  assert.equal(body.documentId, 'chapter_ch08'); assert.equal(body.chapter.body[1].text, 'Only chapter eight changes.');
  const update = CONTENT_DB.batchItems.find((item) => item.sql.includes('UPDATE working_documents SET'));
  assert.equal(update.args[5], 'working-b');
});

test('agent MCP tool grants authorize only their mapped semantic operations', async () => {
  const source = { ...baseChapter(), chapterId: 'chapter_ch07' };
  const working = { id: 'working-agent', document_id: 'chapter_ch07', base_revision_id: 'revision-agent', content_hash: await sha256(source), content_text: JSON.stringify(source), version: 1, state: 'open', purpose: 'authoring', current_revision_id: 'revision-agent' };
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('SELECT w.*, c.state')) return { results: [working] };
    return null;
  });
  const allowed = withAgentCapability({ CONTENT_DB }, { scopes: ['content:write'], allowedOperations: ['replace_passage_text'] });
  let response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-agent/operations:batch', { method: 'POST', headers: agentHeaders(), body: JSON.stringify({ documentId: 'chapter_ch07', baseRevisionId: 'revision-agent', expectedVersion: 1, idempotencyKey: 'agent-semantic-map-1', operations: [{ type: 'text.replace', blockId: 'b-work', text: 'Mapped MCP edit.' }] }) }), allowed);
  assert.equal(response.status, 200, await response.text());

  response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-agent/operations:batch', { method: 'POST', headers: agentHeaders(), body: JSON.stringify({ documentId: 'chapter_ch07', baseRevisionId: 'revision-agent', expectedVersion: 1, idempotencyKey: 'agent-semantic-map-2', operations: [{ type: 'chapter.replaceDocument', document: source }] }) }), allowed);
  assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'CAPABILITY_OPERATION_FORBIDDEN');
});

test('multi-document diff returns one content-free result per working copy', async () => {
  const base = baseChapter(); const changed = structuredClone(base); changed.body[0].text = 'Changed without leaking into the diff.';
  const CONTENT_DB = fakeDb((sql) => sql.includes('FROM changesets c JOIN working_documents') ? { results: [
    { state: 'open', document_id: 'chapter_ch07', base_revision_id: 'revision-a', content_hash: 'hash-a2', content_text: JSON.stringify(changed), version: 2, base_content_hash: 'hash-a1', base_content_text: JSON.stringify(base) },
    { state: 'open', document_id: 'chapter_ch08', base_revision_id: 'revision-b', content_hash: 'hash-b1', content_text: JSON.stringify(base), version: 1, base_content_hash: 'hash-b1', base_content_text: JSON.stringify(base) }
  ] } : null);
  const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-multi:diff', { method: 'POST', headers: gatewayHeaders('content:read'), body: '{}' }), { CONTENT_DB });
  const text = await response.text(); assert.equal(response.status, 200, text); const body = JSON.parse(text);
  assert.equal(body.documentCount, 2); assert.deepEqual(body.documents.map((item) => item.documentId), ['chapter_ch07', 'chapter_ch08']);
  assert.equal(body.documents[0].diff.summary.changed, true); assert.equal(body.documents[1].diff.summary.changed, false);
  assert.equal(JSON.stringify(body).includes('Changed without leaking'), false);
});

test('human and explicitly scoped agent live saves atomically advance a D1-authoritative canonical revision', async () => {
  const publishable = { ...baseChapter(), chapterId: 'chapter_ch07', checkpoints: ['commit', 'work', 'reconcile'].map((slot) => ({ checkpointId: `checkpoint-${slot}`, ...checkpoint(slot, `p-${slot}`) })) };
  const contentHash = await sha256(publishable);
  const working = { id: 'working-live', document_id: 'chapter_ch07', base_revision_id: 'revision-base', content_hash: contentHash, content_text: JSON.stringify(publishable), version: 2, state: 'open', purpose: 'editorial', current_revision_id: 'revision-base', current_content_hash: 'old-hash' };
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('SELECT w.*, c.state')) return { results: [working] };
    if (sql.includes('SELECT authority FROM authority_registry')) return { authority: 'd1' };
    if (sql.includes('SELECT document_id, content_hash FROM document_revisions')) return null;
    return null;
  });
  const request = new Request('https://content.example/v1/changesets/cs-live:saveLive', { method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ baseRevisionId: 'revision-base', expectedVersion: 2, idempotencyKey: 'one-click-live-save-1' }) });
  const response = await worker.fetch(request, { CONTENT_DB });
  const text = await response.text(); assert.equal(response.status, 201, text); const body = JSON.parse(text);
  assert.equal(body.live, true); assert.equal(body.state, 'applied'); assert.equal(body.documentId, 'chapter_ch07');
  assert.match(body.revisionId, /^revision_[a-f0-9]{24}$/);
  assert.ok(CONTENT_DB.batchItems.some((item) => item.sql.includes('INSERT INTO document_revisions')));
  assert.ok(CONTENT_DB.batchItems.some((item) => item.sql.includes('UPDATE documents SET current_revision_id')));
  assert.ok(CONTENT_DB.batchItems.some((item) => item.sql.includes("UPDATE changesets SET state = 'applied'")));

  const unscopedAgentResponse = await worker.fetch(new Request('https://content.example/v1/changesets/cs-live:saveLive', { method: 'POST', headers: agentHeaders(), body: JSON.stringify({ baseRevisionId: 'revision-base', expectedVersion: 2, idempotencyKey: 'one-click-live-save-agent-denied' }) }), withAgentCapability({ CONTENT_DB }, { scopes: ['content:write'] }));
  assert.equal(unscopedAgentResponse.status, 403); assert.equal((await unscopedAgentResponse.json()).error.code, 'LIVE_SAVE_AUTHORITY_REQUIRED');

  const scopedAgentResponse = await worker.fetch(new Request('https://content.example/v1/changesets/cs-live:saveLive', { method: 'POST', headers: agentHeaders(), body: JSON.stringify({ baseRevisionId: 'revision-base', expectedVersion: 2, idempotencyKey: 'one-click-live-save-agent-allowed' }) }), withAgentCapability({ CONTENT_DB }, { scopes: ['content:write', 'content:live-save'] }));
  assert.equal(scopedAgentResponse.status, 201); assert.equal((await scopedAgentResponse.json()).live, true);
});

test('multi-document submission is all-target CAS and freezes every document atomically', async () => {
  const publishable = (chapterId) => ({ ...baseChapter(), chapterId, checkpoints: ['commit', 'work', 'reconcile'].map((slot) => ({ checkpointId: `${chapterId}-${slot}`, ...checkpoint(slot, `p-${slot}`) })) });
  const chapterA = publishable('chapter_ch07'); const chapterB = publishable('chapter_ch08');
  const hashA = await sha256(chapterA); const hashB = await sha256(chapterB);
  let inheritedRows = [];
  let rows = [
    { id: 'working-a', document_id: 'chapter_ch07', base_revision_id: 'revision-a', content_hash: hashA, content_text: JSON.stringify(chapterA), version: 2, state: 'open', current_revision_id: 'revision-a' },
    { id: 'working-b', document_id: 'chapter_ch08', base_revision_id: 'revision-b', content_hash: hashB, content_text: JSON.stringify(chapterB), version: 4, state: 'open', current_revision_id: 'revision-newer' }
  ];
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('SELECT w.*, c.state')) return { results: rows };
    if (sql.includes('FROM authority_registry a JOIN documents')) return { results: inheritedRows };
    return null;
  });
  let snapshotText = null;
  const CONTENT_SNAPSHOTS = { head: async () => null, put: async (_key, value) => { snapshotText = value; } };
  const requestBody = { documents: [{ documentId: 'chapter_ch07', baseRevisionId: 'revision-a', expectedVersion: 2 }, { documentId: 'chapter_ch08', baseRevisionId: 'revision-b', expectedVersion: 4 }], idempotencyKey: 'multi-submit-key-1' };
  let response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-multi:submitReview', { method: 'POST', headers: gatewayHeaders('content:submit'), body: JSON.stringify(requestBody) }), { CONTENT_DB, CONTENT_SNAPSHOTS });
  assert.equal(response.status, 409); const conflict = await response.json(); assert.equal(conflict.error.code, 'REVISION_CONFLICT'); assert.equal(conflict.error.details.conflicts[0].documentId, 'chapter_ch08'); assert.equal(snapshotText, null);
  rows = rows.map((item) => ({ ...item, current_revision_id: item.base_revision_id }));
  response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-multi:submitReview', { method: 'POST', headers: gatewayHeaders('content:submit'), body: JSON.stringify({ ...requestBody, idempotencyKey: 'multi-submit-key-2' }) }), { CONTENT_DB, CONTENT_SNAPSHOTS });
  const text = await response.text(); assert.equal(response.status, 201, text); const body = JSON.parse(text); const snapshot = JSON.parse(snapshotText);
  assert.equal(body.documentCount, 2); assert.equal(snapshot.documents.length, 2); assert.deepEqual(snapshot.documents.map((item) => item.documentId), ['chapter_ch07', 'chapter_ch08']);
  const submittedInsert = CONTENT_DB.batchItems.find((item) => item.sql.includes('INSERT INTO submitted_snapshots'));
  assert.equal(submittedInsert.args[5], 2);
  const inheritedChapter = { ...publishable('chapter_ch09'), revisionId: 'revision-live-ch09', chapterVersion: 'revision-live-ch09', status: 'published' };
  inheritedRows = [{ document_id: 'chapter_ch09', current_revision_id: inheritedChapter.revisionId, current_content_hash: await sha256(inheritedChapter), content_text: stableStringify(inheritedChapter), r2_object_key: null, metadata_json: '{}' }];
  response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-multi:submitReview', { method: 'POST', headers: gatewayHeaders('content:submit'), body: JSON.stringify({ ...requestBody, idempotencyKey: 'multi-submit-key-3' }) }), { CONTENT_DB, CONTENT_SNAPSHOTS });
  const inheritedText = await response.text(); assert.equal(response.status, 201, inheritedText); const inheritedBody = JSON.parse(inheritedText); const inheritedSnapshot = JSON.parse(snapshotText);
  assert.equal(inheritedBody.documentCount, 3); assert.equal(inheritedBody.changedDocumentCount, 2); assert.equal(inheritedBody.inheritedDocumentCount, 1);
  assert.equal(inheritedSnapshot.documents.find((item) => item.documentId === 'chapter_ch09').inherited, true);
});

test('reject endpoint requires a reason, binds the exact snapshot, and records actor provenance', async () => {
  const snapshot = { id: 'snapshot-1', state: 'submitted', snapshot_hash: 'a'.repeat(64), snapshot_revision: 'snapshotrev-1' };
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM submitted_snapshots s')) return snapshot;
    return null;
  });
  const requestBody = { snapshotHash: snapshot.snapshot_hash, snapshotRevision: snapshot.snapshot_revision, decisionKind: 'editorial', comment: 'The checkpoint anchor no longer matches the passage.', idempotencyKey: 'reject-key-123' };
  const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-1:reject', { method: 'POST', headers: gatewayHeaders('content:approve'), body: JSON.stringify(requestBody) }), { CONTENT_DB });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).decision, 'rejected');
  assert.match(CONTENT_DB.batchItems[0].sql, /'rejected'/);
  assert.match(CONTENT_DB.batchItems[1].sql, /state = 'rejected'/);
  const auditStatement = CONTENT_DB.batchItems.find((item) => item.sql.includes('INSERT INTO audit_events'));
  assert.deepEqual(auditStatement.args.slice(1, 4), ['actor_reviewer_1', 'human', 'changeset.rejected']);

  const missingReason = await worker.fetch(new Request('https://content.example/v1/changesets/cs-2:reject', { method: 'POST', headers: gatewayHeaders('content:approve'), body: JSON.stringify({ ...requestBody, comment: '' }) }), { CONTENT_DB });
  assert.equal(missingReason.status, 422);
  assert.equal((await missingReason.json()).error.code, 'REJECTION_REASON_REQUIRED');
  const staleSnapshot = await worker.fetch(new Request('https://content.example/v1/changesets/cs-3:reject', { method: 'POST', headers: gatewayHeaders('content:approve'), body: JSON.stringify({ ...requestBody, snapshotHash: 'b'.repeat(64), idempotencyKey: 'reject-key-456' }) }), { CONTENT_DB });
  assert.equal(staleSnapshot.status, 409);
  assert.equal((await staleSnapshot.json()).error.code, 'REVISION_CONFLICT');
});

test('agent and service identities cannot approve, reject, or publish even when they carry privileged scopes', async () => {
  const headers = agentHeaders();
  for (const action of ['approve', 'reject', 'publish']) {
    const response = await worker.fetch(new Request(`https://content.example/v1/changesets/cs-1:${action}`, { method: 'POST', headers, body: '{}' }), withAgentCapability({}, { actorId: 'actor_automation_1', scopes: ['content:approve', 'content:publish'] }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'HUMAN_ACTOR_REQUIRED');
  }
});

test('a rejected or merely submitted changeset cannot publish even if an older release approval still exists', async () => {
  for (const state of ['rejected', 'submitted']) {
    const CONTENT_DB = fakeDb((sql) => {
      if (sql.includes('FROM idempotency_records')) return null;
      if (sql.includes('FROM submitted_snapshots s')) return { id: 'snapshot-1', state, snapshot_hash: 'a'.repeat(64), snapshot_revision: 'snapshotrev-1' };
      if (sql.includes('FROM approvals')) return { id: 'stale-release-approval' };
      return null;
    });
    const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-1:publish', {
      method: 'POST', headers: gatewayHeaders('content:publish'), body: JSON.stringify({ snapshotHash: 'a'.repeat(64), snapshotRevision: 'snapshotrev-1', idempotencyKey: `publish-${state}-key` })
    }), { CONTENT_DB });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'CHANGESET_NOT_APPROVED');
    assert.equal(CONTENT_DB.statements.some((item) => item.sql.includes('SELECT id FROM approvals')), false);
  }
});

test('even an approved snapshot cannot use the permanently disabled direct publication endpoint', async () => {
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM submitted_snapshots s')) return { id: 'snapshot-1', state: 'approved', snapshot_hash: 'a'.repeat(64), snapshot_revision: 'snapshotrev-1' };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-1:publish', { method: 'POST', headers: gatewayHeaders('content:publish'), body: JSON.stringify({ snapshotHash: 'a'.repeat(64), snapshotRevision: 'snapshotrev-1', idempotencyKey: 'publish-approved-key' }) }), { CONTENT_DB });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DEPLOYMENT_RECEIPT_REQUIRED');
  assert.equal(CONTENT_DB.statements.some((item) => item.sql.includes('SELECT id FROM approvals')), false);
});

test('restore-as-draft seeds historical content but bases the new changeset on current canonical revision', async () => {
  const restoreResolver = (sql) => {
    if (sql.includes('SELECT authority FROM authority_registry')) return { authority: 'd1' };
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('JOIN document_revisions target')) return {
      current_revision_id: 'revision-current', current_content_hash: 'current-hash', target_content_hash: 'historical-hash',
      target_content_text: JSON.stringify(baseChapter()), target_r2_object_key: null, target_metadata_json: '{"era":"historical"}'
    };
    return null;
  };
  const CONTENT_DB = fakeDb(restoreResolver);
  const response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/revisions/revision-old:restoreAsDraft', {
    method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ title: 'Restore prior chapter', idempotencyKey: 'restore-key-123' })
  }), { CONTENT_DB });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.baseRevisionId, 'revision-current');
  assert.equal(body.restoredFromRevisionId, 'revision-old');
  assert.equal(body.contentHash, 'historical-hash');
  const changesetInsert = CONTENT_DB.batchItems[0];
  assert.deepEqual(changesetInsert.args.slice(3, 7), ['actor_reviewer_1', 'human', 'studio', 'run-review-1']);
  assert.equal(changesetInsert.args[7], 'revision-old');
  const workingInsert = CONTENT_DB.batchItems[1];
  assert.equal(workingInsert.args[3], 'revision-current');
  assert.equal(workingInsert.args[4], 'historical-hash');

  const agentDb = fakeDb(restoreResolver);
  const agentResponse = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/revisions/revision-old:restoreAsDraft', {
    method: 'POST', headers: agentHeaders(), body: JSON.stringify({ title: 'Agent restore prior chapter', idempotencyKey: 'restore-key-agent-123' })
  }), withAgentCapability({ CONTENT_DB: agentDb }, { scopes: ['content:write'], allowedDocumentIds: ['chapter-07'], allowedOperations: ['restore_revision_as_draft'] }));
  assert.equal(agentResponse.status, 201, await agentResponse.text());
});

test('chapter revision history is bounded, content-free, and marks the canonical head', async () => {
  const CONTENT_DB = fakeDb((sql, _args, mode) => {
    if (sql.includes('SELECT current_revision_id FROM documents')) return { current_revision_id: 'revision-current' };
    if (sql.includes('FROM document_revisions') && mode === 'all') return { results: [
      { id: 'revision-current', parent_revision_id: 'revision-old', content_hash: 'a'.repeat(64), created_by: 'actor_editor', created_at: '2026-08-03T01:00:00Z', created_actor_type: 'agent', created_client_id: 'codex', created_run_id: 'run-123', metadata_json: '{"status":"published","publicationMode":"instructor-live-save","private":"must-not-leak"}' },
      { id: 'revision-old', parent_revision_id: null, content_hash: 'b'.repeat(64), created_by: 'actor_import', created_at: '2026-08-02T01:00:00Z', metadata_json: '{}' }
    ] };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter_ch07/revisions?limit=10', { headers: agentHeaders() }), withAgentCapability({ CONTENT_DB }, { scopes: ['content:read'], allowedDocumentIds: ['chapter_ch07'], allowedOperations: ['get_version_history'] }));
  const responseText = await response.text(); assert.equal(response.status, 200, responseText); const body = JSON.parse(responseText);
  assert.equal(body.revisions[0].current, true); assert.equal(body.revisions[0].status, 'published'); assert.equal(body.revisions[0].actorType, 'agent'); assert.equal(body.revisions[0].clientId, 'codex'); assert.equal(body.revisions[0].publicationMode, 'instructor-live-save');
  assert.equal(body.revisions[1].current, false); assert.equal(JSON.stringify(body).includes('must-not-leak'), false);
});

test('chapter index exposes per-chapter authoring state and repository-authoritative chapters reject browser drafts', async () => {
  const CONTENT_DB = fakeDb((sql, _args, mode) => {
    if (sql.includes('FROM documents d LEFT JOIN authority_registry') && mode === 'all') return { results: [{ id: 'chapter_ch07', authority: 'git' }, { id: 'chapter_ch08', authority: 'git' }, { id: 'chapter_ch09', authority: 'd1' }] };
    if (sql.includes('SELECT authority FROM authority_registry')) return { authority: 'git' };
    if (sql.includes('FROM idempotency_records')) return null;
    return null;
  });
  let response = await worker.fetch(new Request('https://content.example/v1/chapters', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 200); const index = await response.json();
  assert.deepEqual(index.chapters.map((item) => item.authoringState), ['readOnly', 'readOnly', 'editable']);
  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter_ch08/changesets', { method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ title: 'Forbidden shadow write', idempotencyKey: 'authoring-gate-key' }) }), { CONTENT_DB });
  assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'AUTHORING_NOT_ENABLED');
});

test('release metadata reconstructs the frozen snapshot, authority, approvals, pointer, and deployment audit trail', async () => {
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM releases r')) return { id: 'release-1', changeset_id: 'cs-1', state: 'published', manifest_hash: 'a'.repeat(64), snapshot_id: 'snapshot-1', snapshot_hash: 'a'.repeat(64), snapshot_revision: 'snapshotrev-1', snapshot_object_key: `submitted/${'a'.repeat(64)}.json`, snapshot_document_count: 1, snapshot_created_at: '2026-08-03T00:00:00Z' };
    if (sql.includes('FROM release_authority_entries')) return { results: [{ document_id: 'chapter-07', authority: 'd1', source_path: null, source_revision: 'revision-7', normalized_snapshot_hash: 'chapter-hash' }] };
    if (sql.includes('FROM approvals')) return { results: [{ id: 'approval-1', decision_kind: 'release', decision: 'approved', decided_by: 'actor_reviewer_1' }] };
    if (sql.includes('FROM deployment_receipts')) return { results: [{ id: 'receipt-1', transaction_id: 'transaction-1', action: 'promote', receipt_hash: 'b'.repeat(64), cloudflare_version_id: 'version-1' }] };
    if (sql.includes('FROM release_pointer_history')) return { results: [{ sequence: 7, previous_release_id: 'release-0', release_id: 'release-1', transaction_id: 'transaction-1', receipt_id: 'receipt-1' }] };
    if (sql.includes('FROM release_deployment_transactions')) return { results: [{ id: 'transaction-1', action: 'promote', state: 'completed', expected_active_release_id: 'release-0', cloudflare_version_id: 'version-1' }] };
    if (sql.includes('FROM release_pointers')) return { release_id: 'release-1', updated_by: 'actor_publisher', updated_at: '2026-08-03T00:00:00Z' };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/releases/release-1', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.active, true);
  assert.equal(body.snapshot.downloadPath, `/v1/release-snapshots/${'a'.repeat(64)}`);
  assert.equal(body.authority[0].source_revision, 'revision-7');
  assert.equal(body.approvals[0].id, 'approval-1');
  assert.equal(body.deploymentReceipts[0].receipt_hash, 'b'.repeat(64));
  assert.equal(body.pointerHistory[0].sequence, 7);
  assert.equal(body.deploymentTransactions[0].state, 'completed');
  assert.equal(body.snapshot_hash, undefined);
});

test('media reuse search is parameterized, bounded, paginated, and available to media readers', async () => {
  const CONTENT_DB = fakeDb((sql) => sql.includes('FROM media_assets a JOIN media_asset_versions') ? { results: [
    { id: 'media-1', title: 'Trolley diagram', media_version_id: 'version-1', source_sha256: 'a'.repeat(64), rights_status: 'cleared' },
    { id: 'media-2', title: 'Second result', media_version_id: 'version-2', source_sha256: 'b'.repeat(64), rights_status: 'cleared' },
    { id: 'media-3', title: 'Pagination sentinel', media_version_id: 'version-3', source_sha256: 'c'.repeat(64), rights_status: 'cleared' }
  ] } : null);
  const headers = { ...gatewayHeaders('media:read'), 'x-content-actor-id': 'actor_media_reader' };
  const response = await worker.fetch(new Request('https://content.example/v1/media?q=Trolley&kind=image&rightsStatus=cleared&limit=2&cursor=4', { headers }), { CONTENT_DB });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.media.length, 2);
  assert.equal(body.page.nextCursor, '6');
  const query = CONTENT_DB.statements.find((item) => item.sql.includes('FROM media_assets a JOIN media_asset_versions'));
  assert.match(query.sql, /LOWER\(a\.title\) LIKE \? ESCAPE/);
  assert.doesNotMatch(query.sql, /WHEN v\.detected_mime/);
  assert.doesNotMatch(query.sql, /Trolley/);
  assert.deepEqual(query.args.slice(-2), [3, 4]);
  const invalid = await worker.fetch(new Request('https://content.example/v1/media?limit=500', { headers }), { CONTENT_DB });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'PAGINATION_INVALID');
});

test('curated person catalog returns frozen projections and exact person reads', async () => {
  const chapter = baseChapter();
  chapter.entityRevisions = [{ entityRevisionId: 'revision_aristotle', personId: 'aristotle', sha256: 'a'.repeat(64), sourcePath: 'content/entities/people/records/aristotle.json' }];
  chapter.personFeatures = [{ personFeatureId: 'feature_aristotle', placementId: 'placement_aristotle', personId: 'aristotle', entityRevisionId: 'revision_aristotle', name: 'Aristotle', dates: '384–322 BCE', role: 'Greek philosopher', teachingNote: 'Virtue ethics', biography: 'A curated biography.', portrait: { mediaId: 'portrait_aristotle' }, primarySources: [] }];
  const CONTENT_DB = fakeDb((sql) => sql.includes("json_array_length(json_extract") ? { results: [{ document_id: 'chapter_ch07', content_text: JSON.stringify(chapter) }] } : null);
  let response = await worker.fetch(new Request('https://content.example/v1/persons?q=aristotle', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  let body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.persons[0].personId, 'aristotle');
  assert.equal(body.persons[0].personFeatureId, undefined);
  assert.equal(body.persons[0].entityRevision.entityRevisionId, 'revision_aristotle');
  response = await worker.fetch(new Request('https://content.example/v1/persons/aristotle', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body)); assert.equal(body.person.name, 'Aristotle');
});

test('provider resolver is registry-only, performs no fetch, and falls back to authored rich links', async () => {
  assert.equal(PROVIDER_REGISTRY.youtube.adapterVersion, 'youtube-v1');
  assert.deepEqual(resolveProviderUrl('https://youtu.be/abc123?t=8').identity, { provider: 'youtube', resourceType: 'video', resourceId: 'abc123' });
  assert.deepEqual(resolveProviderUrl('https://vimeo.com/123456/secretHash').identity, { provider: 'vimeo', resourceType: 'video', resourceId: '123456', unlistedHash: 'secretHash' });
  assert.equal(resolveProviderUrl('https://x.com/example/status/987654').canonicalUrl, 'https://x.com/example/status/987654');
  const fallback = resolveProviderUrl('https://example.org/source');
  assert.equal(fallback.kind, 'richLink');
  assert.equal(fallback.networkAccess, false);
  assert.throws(() => resolveProviderUrl('https://169.254.169.254/latest'), (error) => error instanceof ApiError && error.code === 'URL_NOT_PUBLIC_HTTPS');
  assert.throws(() => resolveProviderUrl('https://youtu.be/abc123', 'vimeo'), (error) => error instanceof ApiError && error.code === 'PROVIDER_IDENTITY_MISMATCH');
  const response = await worker.fetch(new Request('https://content.example/v1/embeds:resolve', { method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=abc123' }) }), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).proposal.networkAccess, false);
});

test('chapter passage and dependency reads are revision-bound and bounded', async () => {
  const chapter = baseChapter();
  chapter.revisionId = 'revision-current';
  chapter.checkpoints = [{ checkpointId: 'checkpoint-work', slot: 'work', passageId: 'p-work' }];
  chapter.body.push({ type: 'mediaFigure', blockId: 'b-media', figureId: 'figure-1', mediaId: 'media-1', mediaVersionId: 'version-1', rightsCaseId: 'rights-1', anchorPassageId: 'p-work', passageId: 'p-media' });
  const CONTENT_DB = fakeDb((sql) => sql.includes('FROM documents d JOIN document_revisions') ? { id: 'chapter-07', current_revision_id: 'revision-current', current_content_hash: 'chapter-hash', content_text: JSON.stringify(chapter), metadata_json: '{}', state: 'active' } : null);
  let response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/passages?limit=2', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.passages.length, 2);
  assert.equal(body.page.nextCursor, '2');
  assert.equal(body.passages[0].excerpt, 'Commit passage.');
  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/passages/p-work', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).block.text, 'Work passage.');
  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/dependencies?limit=10', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 200);
  body = await response.json();
  assert.equal(body.edges.some((edge) => edge.source === 'figure-1' && edge.target === 'version-1' && edge.kind === 'pinsVersion'), true);
  assert.equal(body.edges.some((edge) => edge.source === 'checkpoint-work' && edge.target === 'p-work'), true);
  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/dependencies?passageId=p-work&limit=1', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 200);
  body = await response.json();
  assert.equal(body.passageId, 'p-work');
  assert.equal(body.edges.every((edge) => edge.source === 'p-work' || edge.target === 'p-work'), true);
  assert.equal(body.page.totalEdges >= 2, true);
  assert.equal(body.page.nextCursor, '1');
  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/dependencies?passageId=missing', { headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 404);
});

test('fixed-window mutation limits persist hashed actor-client keys and fail closed', async () => {
  const limitDb = fakeDb((sql, _args, mode) => sql.includes('INSERT INTO api_rate_limits') && mode === 'batch' ? { results: [], meta: { changes: 0 } } : null);
  const request = () => new Request('https://content.example/v1/chapters/chapter-07/changesets', { method: 'POST', headers: gatewayHeaders('content:write'), body: JSON.stringify({ title: 'Rate test', idempotencyKey: 'rate-key-123' }) });
  let response = await worker.fetch(request(), { CONTENT_DB: limitDb });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, 'RATE_LIMIT_EXCEEDED');
  const rateStatement = limitDb.statements.find((item) => item.sql.includes('INSERT INTO api_rate_limits'));
  assert.match(rateStatement.args[0], /^[a-f0-9]{64}$/);
  assert.equal(rateStatement.args[0].includes('actor_reviewer_1'), false);
  assert.equal(rateStatement.args[1], 'mutation');
  response = await worker.fetch(request(), { CONTENT_DB: { prepare() { throw new Error('D1 unavailable'); } } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'RATE_LIMIT_STORE_UNAVAILABLE');
});

const reviewDeclarations = () => ({
  rights: { basis: 'licensed', creator: 'Course author', sourceUrl: 'https://example.org/source', license: 'CC BY 4.0', attribution: 'Course author, CC BY 4.0' },
  editorial: { teachingUse: 'Compare the visual model with the case.', placementIntent: 'After the work passage.' },
  accessibility: { decorative: false, altText: 'A diagram of the case.', motionReview: 'notApplicable' },
  idempotencyKey: 'review-package-key-123'
});

test('review packages issue server IDs and only humans can decide the exact declaration hash', async () => {
  const CONTENT_DB = fakeDb((sql) => sql.includes('FROM idempotency_records') ? null : null);
  let response = await worker.fetch(new Request('https://content.example/v1/media-review-packages', { method: 'POST', headers: gatewayHeaders('media:upload'), body: JSON.stringify(reviewDeclarations()) }), { CONTENT_DB });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.match(created.id, /^reviewpkg_[a-f0-9]{24}$/);
  assert.match(created.declarationHash, /^[a-f0-9]{64}$/);
  assert.match(created.rightsReviewId, /^rightsreview_/);
  const decisionDb = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM media_review_packages')) return { id: created.id, state: 'pending', declaration_hash: created.declarationHash };
    return null;
  });
  response = await worker.fetch(new Request(`https://content.example/v1/media-review-packages/${created.id}:decide`, { method: 'POST', headers: gatewayHeaders('content:approve'), body: JSON.stringify({ declarationHash: created.declarationHash, decision: 'cleared', comment: 'Rights and accessibility declarations verified.', idempotencyKey: 'review-decision-key-123' }) }), { CONTENT_DB: decisionDb });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).state, 'cleared');
  assert.match(decisionDb.batchItems[1].sql, /UPDATE media_rights_cases SET status = \?/);
  const stale = await worker.fetch(new Request(`https://content.example/v1/media-review-packages/${created.id}:decide`, { method: 'POST', headers: gatewayHeaders('content:approve'), body: JSON.stringify({ declarationHash: 'c'.repeat(64), decision: 'blocked', comment: 'Stale declaration.', idempotencyKey: 'review-decision-key-456' }) }), { CONTENT_DB: decisionDb });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, 'REVISION_CONFLICT');
  response = await worker.fetch(new Request(`https://content.example/v1/media-review-packages/${created.id}:decide`, { method: 'POST', headers: agentHeaders(), body: '{}' }), withAgentCapability({}, { actorId: 'actor_review_agent', scopes: ['content:approve'] }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'HUMAN_ACTOR_REQUIRED');
});

test('upload requests require a persisted review package and substantive transcript equivalent for timed media', async () => {
  const imageUpload = { filename: 'case.png', mimeType: 'image/png', bytes: 100, sha256: 'a'.repeat(64), idempotencyKey: 'upload-key-123', reviewPackageId: `reviewpkg_${'a'.repeat(24)}` };
  const CONTENT_DB = fakeDb((sql) => sql.includes('FROM media_review_packages') ? null : null);
  const bindings = { CONTENT_DB, UPLOAD_QUARANTINE: {}, CONTENT_MEDIA: {}, MEDIA_JOB_ENVELOPES: {}, MEDIA_JOBS: {} };
  let response = await worker.fetch(new Request('https://content.example/v1/media:requestUpload', { method: 'POST', headers: gatewayHeaders('media:upload'), body: JSON.stringify(imageUpload) }), bindings);
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'REVIEW_PACKAGE_NOT_FOUND');
  assert.throws(() => validateUploadRequest({ ...imageUpload, filename: 'clip.mp4', mimeType: 'video/mp4' }), (error) => error instanceof ApiError && error.code === 'TRANSCRIPT_EQUIVALENT_REQUIRED');
  const transcript = 'A substantive transcript describing the complete spoken content.';
  assert.equal(validateUploadRequest({ ...imageUpload, filename: 'clip.mp4', mimeType: 'video/mp4', transcriptEquivalent: { provided: true, language: 'en', text: transcript }, poster: { provided: true, alt: 'Video poster.' } }).transcriptEquivalent.text, transcript);
  assert.equal(validateUploadRequest({ ...imageUpload, filename: 'clip.webm', mimeType: 'video/webm', transcriptEquivalent: { provided: true, language: 'en', text: transcript }, poster: { provided: true, alt: 'Video poster.' } }).mimeType, 'video/webm');
  assert.equal(validateUploadRequest({ ...imageUpload, filename: 'notes.txt', mimeType: 'text/plain', bytes: 128 }).maxBytes, 5 * 1024 * 1024);
});

test('release assets stream only approved DB-referenced immutable bytes with exact integrity', async () => {
  const raw = new TextEncoder().encode('immutable derivative');
  const assetHash = await sha256Bytes(raw.buffer);
  const CONTENT_DB = fakeDb((sql) => sql.includes('FROM submitted_snapshot_media_assets') ? { object_key: 'media/job/sha256/source/display.webp', object_sha256: assetHash, object_bytes: raw.byteLength, content_type: 'image/webp', role: 'derivative' } : null);
  const CONTENT_MEDIA = { get: async (key) => key.startsWith('media/') ? { size: raw.byteLength, customMetadata: { sha256: assetHash }, arrayBuffer: async () => raw.buffer } : null };
  const headers = { ...gatewayHeaders('content:releaseSnapshot'), 'x-content-actor-id': 'actor_release_reader', 'x-content-actor-type': 'service' };
  let response = await worker.fetch(new Request(`https://content.example/v1/release-assets/${assetHash}`, { headers }), { CONTENT_DB, CONTENT_MEDIA });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-sha256'), assetHash);
  assert.equal(await response.text(), 'immutable derivative');
  const lookup = CONTENT_DB.statements.find((item) => item.sql.includes('FROM submitted_snapshot_media_assets'));
  assert.match(lookup.sql, /a\.decision_kind = 'release' AND a\.decision = 'approved'/);
  response = await worker.fetch(new Request(`https://content.example/v1/release-assets/${'b'.repeat(64)}`, { headers }), { CONTENT_DB: fakeDb(() => null), CONTENT_MEDIA });
  assert.equal(response.status, 404);
});

test('submit freezes exact cleared media versions and immutable derivative metadata at snapshot root', async () => {
  const chapter = baseChapter();
  chapter.checkpoints = ['commit', 'work', 'reconcile'].map((slot) => ({ checkpointId: `checkpoint-${slot}`, ...checkpoint(slot, `p-${slot}`) }));
  chapter.body.push({ type: 'mediaFigure', blockId: 'b-media', figureId: 'figure-1', mediaId: 'media-1', mediaVersionId: 'version-1', rightsCaseId: 'rights-1', anchorPassageId: 'p-work', decorative: false, alt: 'A diagram.', caption: 'Case diagram.', teachingUse: 'Compare the cases.', displayPreset: 'reading', align: 'center', printPolicy: 'poster', downloadable: true });
  const editorialHash = await sha256(chapter);
  const derivativeBytes = new TextEncoder().encode('derivative bytes');
  const derivativeHash = await sha256Bytes(derivativeBytes.buffer);
  let submittedText;
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('SELECT w.*, c.state')) return { results: [{ id: 'working-1', document_id: 'chapter-07', base_revision_id: 'revision-base', content_hash: editorialHash, content_text: JSON.stringify(chapter), r2_object_key: null, metadata_json: '{}', version: 1, state: 'open', current_revision_id: 'revision-base' }] };
    if (sql.includes('FROM media_assets a JOIN media_asset_versions')) return { media_id: 'media-1', title: 'Case diagram', media_state: 'ready', media_version_id: 'version-1', source_sha256: 'a'.repeat(64), source_bytes: 100, detected_mime: 'image/png', immutable_address: `sha256:${'a'.repeat(64)}`, technical_json: '{"animated":false}', rights_case_id: 'rights-1', review_id: 'rights-review-1', rights_status: 'cleared', review_package_id: 'review-package-1', review_package_state: 'cleared', rights_json: '{"attribution":"Author, CC BY"}', editorial_json: '{}', accessibility_json: '{}', declaration_hash: 'b'.repeat(64) };
    if (sql.includes('FROM media_version_objects')) return { results: [{ id: 'object-1', role: 'derivative', object_key: 'media/job/sha256/source/display.webp', object_sha256: derivativeHash, object_bytes: derivativeBytes.byteLength, content_type: 'image/webp' }] };
    return null;
  });
  const CONTENT_SNAPSHOTS = { head: async () => null, put: async (_key, text) => { submittedText = text; } };
  const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-media:submitReview', { method: 'POST', headers: gatewayHeaders('content:submit'), body: JSON.stringify({ baseRevisionId: 'revision-base', expectedVersion: 1, idempotencyKey: 'submit-media-key-123' }) }), { CONTENT_DB, CONTENT_SNAPSHOTS });
  assert.equal(response.status, 201);
  const snapshot = JSON.parse(submittedText);
  assert.equal(snapshot.schemaVersion, 2);
  assert.equal(snapshot.mediaProjection.assets[0].sha256, derivativeHash);
  assert.equal(snapshot.mediaProjection.assets[0].downloadPath, `/v1/release-assets/${derivativeHash}`);
  assert.equal(snapshot.mediaProjection.versions[0].rights.status, 'cleared');
  assert.equal(snapshot.mediaProjection.placements[0].mediaVersionId, 'version-1');
  assert.equal(snapshot.mediaProjection.placements[0].downloadable, true);
  assert.equal(CONTENT_DB.batchItems.some((item) => item.sql.includes('INSERT INTO submitted_snapshot_media_assets')), true);
  const unclearedDb = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('SELECT w.*, c.state')) return { results: [{ id: 'working-2', document_id: 'chapter-07', base_revision_id: 'revision-base', content_hash: editorialHash, content_text: JSON.stringify(chapter), r2_object_key: null, metadata_json: '{}', version: 1, state: 'open', current_revision_id: 'revision-base' }] };
    if (sql.includes('FROM media_assets a JOIN media_asset_versions')) return { media_id: 'media-1', title: 'Case diagram', media_state: 'ready', media_version_id: 'version-1', source_sha256: 'a'.repeat(64), source_bytes: 100, detected_mime: 'image/png', immutable_address: `sha256:${'a'.repeat(64)}`, technical_json: '{}', rights_case_id: 'rights-1', review_id: 'rights-review-1', rights_status: 'reviewRequired', review_package_id: 'review-package-1', review_package_state: 'pending', rights_json: '{}', editorial_json: '{}', accessibility_json: '{}', declaration_hash: 'b'.repeat(64) };
    return null;
  });
  const uncleared = await worker.fetch(new Request('https://content.example/v1/changesets/cs-uncleared:submitReview', { method: 'POST', headers: gatewayHeaders('content:submit'), body: JSON.stringify({ baseRevisionId: 'revision-base', expectedVersion: 1, idempotencyKey: 'submit-media-key-456' }) }), { CONTENT_DB: unclearedDb, CONTENT_SNAPSHOTS });
  assert.equal(uncleared.status, 422);
  assert.equal((await uncleared.json()).error.code, 'MEDIA_RELEASE_NOT_CLEARED');
});

test('migration keeps content authority, approvals, snapshots, and operation lineage immutable', async () => {
  const schema = await readFile(new URL('../../workers/content-api/migrations/0001_control_plane.sql', import.meta.url), 'utf8');
  assert.match(schema, /CREATE TABLE authority_registry \([\s\S]*document_id TEXT NOT NULL[\s\S]*authority TEXT NOT NULL CHECK \(authority IN \('git', 'd1'\)\)[\s\S]*normalized_snapshot_hash TEXT NOT NULL/);
  assert.match(schema, /CREATE TABLE authority_grants \([\s\S]*principal_type TEXT NOT NULL[\s\S]*role TEXT NOT NULL/);
  assert.match(schema, /CREATE TABLE submitted_snapshots \([\s\S]*changeset_id TEXT NOT NULL UNIQUE[\s\S]*snapshot_hash TEXT NOT NULL UNIQUE[\s\S]*r2_object_key TEXT NOT NULL UNIQUE/);
  assert.match(schema, /CREATE TABLE approvals \([\s\S]*submitted_snapshot_hash TEXT NOT NULL[\s\S]*submitted_snapshot_revision TEXT NOT NULL[\s\S]*decision_kind TEXT NOT NULL CHECK \(decision_kind IN \('content', 'rights', 'editorial', 'release'\)\)/);
  assert.match(schema, /CREATE TABLE content_operations \([\s\S]*client_id TEXT,[\s\S]*run_id TEXT,[\s\S]*base_revision_id TEXT,[\s\S]*result_revision_id TEXT,[\s\S]*idempotency_hash TEXT NOT NULL/);
  assert.match(schema, /operation_json TEXT NOT NULL/);
  assert.match(schema, /working_version INTEGER NOT NULL/);
  assert.match(schema, /CREATE UNIQUE INDEX content_operations_working_version/);
  assert.match(schema, /CREATE TABLE release_authority_entries \([\s\S]*PRIMARY KEY \(release_id, document_id\)/);
});

test('media lifecycle migration adds hard budget checks and immutable promoted metadata', async () => {
  const schema = await readFile(new URL('../../workers/content-api/migrations/0002_media_ingestion.sql', import.meta.url), 'utf8');
  assert.match(schema, /storage_limit_bytes INTEGER NOT NULL DEFAULT 8589934592/);
  assert.match(schema, /ingest_limit_bytes INTEGER NOT NULL DEFAULT 1073741824/);
  assert.match(schema, /CHECK \(stored_bytes \+ reserved_bytes <= storage_limit_bytes\)/);
  assert.match(schema, /CREATE TABLE media_jobs/);
  assert.match(schema, /CREATE TABLE media_asset_versions/);
  assert.match(schema, /source_sha256 TEXT NOT NULL UNIQUE/);
  assert.match(schema, /CREATE TABLE media_processor_callbacks/);
});

test('review-history migration persists actor provenance and restore lineage', async () => {
  const schema = await readFile(new URL('../../workers/content-api/migrations/0003_review_history.sql', import.meta.url), 'utf8');
  assert.match(schema, /ALTER TABLE changesets ADD COLUMN created_actor_type TEXT/);
  assert.match(schema, /ALTER TABLE changesets ADD COLUMN created_client_id TEXT/);
  assert.match(schema, /ALTER TABLE changesets ADD COLUMN created_run_id TEXT/);
  assert.match(schema, /ALTER TABLE changesets ADD COLUMN restored_from_revision_id TEXT REFERENCES document_revisions\(id\)/);
  assert.match(schema, /ALTER TABLE document_revisions ADD COLUMN created_actor_type TEXT/);
  assert.match(schema, /ALTER TABLE audit_events ADD COLUMN actor_type TEXT/);
});

test('rate-limit and media-review migrations persist bounded counters and release asset references', async () => {
  const rateSchema = await readFile(new URL('../../workers/content-api/migrations/0004_api_rate_limits.sql', import.meta.url), 'utf8');
  assert.match(rateSchema, /CREATE TABLE api_rate_limits/);
  assert.match(rateSchema, /PRIMARY KEY \(subject_hash, route_class, window_start\)/);
  const mediaSchema = await readFile(new URL('../../workers/content-api/migrations/0005_media_review_and_release_assets.sql', import.meta.url), 'utf8');
  assert.match(mediaSchema, /CREATE TABLE media_review_packages/);
  assert.match(mediaSchema, /declaration_hash TEXT NOT NULL/);
  assert.match(mediaSchema, /CREATE TABLE media_version_objects/);
  assert.match(mediaSchema, /CREATE TABLE submitted_snapshot_media_assets/);
  assert.match(mediaSchema, /object_sha256 TEXT NOT NULL/);
});

test('responsive-media migration preserves immutable references and allowlists only fixed widths', async () => {
  const schema = await readFile(new URL('../../workers/content-api/migrations/0009_responsive_media_objects.sql', import.meta.url), 'utf8');
  for (const role of ['responsive-640', 'responsive-1280', 'responsive-1920']) assert.match(schema, new RegExp(role));
  assert.match(schema, /INSERT INTO media_version_objects SELECT \* FROM media_version_objects_v1/);
  assert.match(schema, /INSERT INTO submitted_snapshot_media_assets SELECT \* FROM submitted_snapshot_media_assets_v1/);
  assert.doesNotMatch(schema, /responsive-(?:320|768|1024|2560)/);
});

test('authority cutover migration rejects D1 authority ahead of an exact active published release', async () => {
  const schema = await readFile(new URL('../../workers/content-api/migrations/0010_authority_cutover_guard.sql', import.meta.url), 'utf8');
  assert.match(schema, /CREATE TRIGGER authority_d1_requires_active_release/);
  assert.match(schema, /JOIN release_authority_entries e ON e\.release_id = p\.release_id/);
  assert.match(schema, /r\.state = 'published'/);
  assert.match(schema, /e\.source_revision = NEW\.source_revision/);
  assert.match(schema, /e\.normalized_snapshot_hash = NEW\.normalized_snapshot_hash/);
  assert.match(schema, /SELECT RAISE\(ABORT, 'authority_d1_active_release_required'\);/);
  const headGuard = await readFile(new URL('../../workers/content-api/migrations/0011_authority_head_guard.sql', import.meta.url), 'utf8');
  assert.match(headGuard, /DROP TRIGGER authority_d1_requires_active_release/);
  assert.match(headGuard, /JOIN documents d ON d\.id = e\.document_id/);
  assert.match(headGuard, /d\.current_revision_id = NEW\.source_revision/);
  assert.match(headGuard, /d\.current_content_hash = NEW\.normalized_snapshot_hash/);
  const cutover = await readFile(new URL('../../workers/content-api/migrations/0012_cutover_proposals.sql', import.meta.url), 'utf8');
  assert.match(cutover, /purpose TEXT NOT NULL DEFAULT 'authoring'/);
  assert.match(cutover, /'authority_cutover'/);
  const recovery = await readFile(new URL('../../workers/content-api/migrations/0013_deployment_recovery_version.sql', import.meta.url), 'utf8');
  assert.match(recovery, /ALTER TABLE release_deployment_transactions ADD COLUMN previous_cloudflare_version_id TEXT/);
});

const baseChapter = () => ({
  chapterId: 'chapter-07',
  body: [
    { type: 'paragraph', blockId: 'b-commit', passageId: 'p-commit', text: 'Commit passage.' },
    { type: 'paragraph', blockId: 'b-work', passageId: 'p-work', text: 'Work passage.' },
    { type: 'paragraph', blockId: 'b-reconcile', passageId: 'p-reconcile', text: 'Reconcile passage.' }
  ],
  checkpoints: []
});

const checkpoint = (slot, passageId) => ({
  passageId,
  passageExcerptHash: 'a'.repeat(64),
  displayOrder: 0,
  slotLabel: slot,
  stage: slot,
  strategy: slot === 'commit' ? 'initial-judgment' : slot === 'work' ? 'self-explanation' : 'metacognitive-trace',
  title: `${slot} title`,
  trigger: `${slot} trigger`,
  prompt: `${slot} prompt`,
  guidance: `${slot} guidance`,
  responseStructure: 'prose',
  minWords: 30,
  maxWords: 120,
  rationale: `${slot} rationale`,
  showInSidebar: true
});

test('semantic diff is deterministic and reports structure, anchors, embeds, and pinned media impact without copying prose', () => {
  const base = baseChapter();
  base.title = 'Original title';
  base.body.push({ type: 'mediaFigure', blockId: 'b-media', figureId: 'figure-1', mediaId: 'media-1', mediaVersionId: 'version-1', rightsCaseId: 'rights-1', passageId: 'p-media' });
  base.checkpoints = [{ checkpointId: 'checkpoint-work', displayOrder: 1, slotLabel: 'work', passageId: 'p-work', passageExcerptHash: 'a'.repeat(64), prompt: 'Original private prose' }];
  const working = structuredClone(base);
  working.title = 'Revised title';
  working.body = [
    { ...working.body[2] },
    { ...working.body[0], text: 'Sensitive revised prose should not appear in diff.' },
    { type: 'externalEmbed', blockId: 'b-embed', embedId: 'embed-1', canonicalUrl: 'https://example.invalid/private' },
    { ...working.body[3], mediaVersionId: 'version-2' }
  ];
  working.checkpoints[0] = { ...working.checkpoints[0], passageId: 'p-reconcile', passageExcerptHash: 'b'.repeat(64), prompt: 'Revised private prose' };

  const diff = semanticDiffChapter(base, working);
  assert.deepEqual(semanticDiffChapter(base, working), diff);
  assert.equal(diff.summary.changed, true);
  assert.deepEqual(diff.metadata.changedFields, ['title']);
  assert.deepEqual(diff.blocks.added, [{ blockId: 'b-embed', type: 'externalEmbed', afterIndex: 2 }]);
  assert.deepEqual(diff.blocks.removed, [{ blockId: 'b-work', type: 'paragraph', beforeIndex: 1 }]);
  assert.deepEqual(diff.blocks.modified.find((item) => item.blockId === 'b-commit').changedFields, ['text']);
  assert.deepEqual(diff.blocks.modified.find((item) => item.blockId === 'b-media').changedFields, ['mediaVersionId']);
  assert.equal(diff.blocks.moved.length, 1);
  assert.equal(['b-commit', 'b-reconcile'].includes(diff.blocks.moved[0].blockId), true);
  assert.deepEqual(diff.checkpoints.anchorsChanged, [{ checkpointId: 'checkpoint-work', slotLabel: 'work', displayOrder: 1, beforePassageId: 'p-work', afterPassageId: 'p-reconcile', excerptHashChanged: true }]);
  assert.equal(diff.summary.embedsAffected, true);
  assert.equal(diff.summary.mediaAffected, true);
  assert.equal(diff.summary.derivativesAffected, true);
  assert.equal(JSON.stringify(diff).includes('Sensitive revised prose'), false);
  assert.equal(JSON.stringify(diff).includes('Revised private prose'), false);
  assert.deepEqual(semanticDiffChapter(base, structuredClone(base)).summary, {
    changed: false, metadataFieldsChanged: 0, blocksAdded: 0, blocksRemoved: 0, blocksModified: 0, blocksMoved: 0,
    checkpointsAdded: 0, checkpointsRemoved: 0, checkpointsModified: 0, checkpointAnchorsChanged: 0,
    embedsAffected: false, mediaAffected: false, derivativesAffected: false
  });
});

test('checkpoint operations preserve insertion order, arbitrary count, and stable IDs', async () => {
  let result = await applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: checkpoint('reconcile', 'p-reconcile') });
  result = await applySemanticOperation(result.chapter, { type: 'checkpoint.upsert', checkpoint: checkpoint('commit', 'p-commit') });
  result = await applySemanticOperation(result.chapter, { type: 'checkpoint.upsert', checkpoint: checkpoint('work', 'p-work') });
  result = await applySemanticOperation(result.chapter, { type: 'checkpoint.upsert', checkpoint: checkpoint('follow-up', 'p-reconcile') });
  assert.deepEqual(result.chapter.checkpoints.map((item) => item.slotLabel), ['reconcile', 'commit', 'work', 'follow-up']);
  const stableId = result.chapter.checkpoints[2].checkpointId;
  const replacement = checkpoint('work', 'p-reconcile');
  replacement.checkpointId = stableId;
  replacement.prompt = 'Revised work prompt';
  result = await applySemanticOperation(result.chapter, { type: 'checkpoint.replace', checkpoint: replacement });
  assert.equal(result.chapter.checkpoints[2].checkpointId, stableId);
  assert.equal(result.chapter.checkpoints[2].passageId, 'p-reconcile');
  assert.deepEqual(validateChapter(result.chapter, { publishable: true }), { valid: true, errors: [] });
});

test('checkpoint validation rejects unstable anchors and caller-selected IDs while any count remains publishable', async () => {
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: checkpoint('commit', 'missing') }), (error) => error instanceof ApiError && error.code === 'CHECKPOINT_ANCHOR_MISSING');
  const noSidebar = checkpoint('commit', 'p-commit');
  noSidebar.showInSidebar = false;
  const hidden = await applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: noSidebar });
  assert.equal(hidden.chapter.checkpoints[0].showInSidebar, false);
  assert.deepEqual(validateChapter(baseChapter(), { publishable: true }), { valid: true, errors: [] });
  const clientId = checkpoint('commit', 'p-commit');
  clientId.checkpointId = 'client-selected';
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: clientId }), (error) => error instanceof ApiError && error.code === 'CHECKPOINT_ID_SERVER_ASSIGNED');
});

test('chapter replacement rejects empty or oversized optional checkpoint labels', () => {
  for (const stage of ['', 'x'.repeat(121)]) {
    const chapter = baseChapter();
    chapter.checkpoints.push({ ...checkpoint('commit', 'p-commit'), checkpointId: 'checkpoint-stage-limit', stage });
    assert.deepEqual(validateChapter(chapter).errors.filter((error) => error.code === 'CHECKPOINT_STAGE_INVALID'), [
      { code: 'CHECKPOINT_STAGE_INVALID', path: 'checkpoints.0.stage' }
    ]);
  }
});

test('checkpoint hashes are server-derived for every selectable anchor type', async () => {
  const chapter = baseChapter();
  const table = { type: 'table', blockId: 'b-table', passageId: 'p-table', columns: ['Claim', 'Reason'], rows: [['A', 'B']] };
  const code = { type: 'codeBlock', blockId: 'b-code', passageId: 'p-code', code: 'const judgment = true;' };
  chapter.body.push(table, code);
  let result = await applySemanticOperation(chapter, { type: 'checkpoint.upsert', checkpoint: checkpoint('table', 'p-table') });
  assert.equal(result.chapter.checkpoints[0].passageExcerptHash, await sha256(checkpointExcerpt(table)));
  const replacement = structuredClone(result.chapter);
  replacement.checkpoints[0].passageId = 'p-code';
  replacement.checkpoints[0].passageExcerptHash = '0'.repeat(64);
  result = await applySemanticOperation(result.chapter, { type: 'chapter.replaceDocument', document: replacement });
  assert.equal(result.chapter.checkpoints[0].passageExcerptHash, await sha256(checkpointExcerpt(code)));
  assert.notEqual(result.chapter.checkpoints[0].passageExcerptHash, await sha256(''));
  assert.equal(checkpointExcerpt({ type: 'list', text: 'stale', items: ['Visible A', 'Visible B'] }), 'Visible A\nVisible B');
});

test('malformed replacement bodies fail as structured validation errors before hash binding', async () => {
  const chapter = baseChapter();
  chapter.checkpoints.push({ ...checkpoint('commit', 'p-commit'), checkpointId: 'checkpoint-malformed-body' });
  await assert.rejects(
    applySemanticOperation(chapter, { type: 'chapter.replaceDocument', document: { ...chapter, body: { invalid: true } } }),
    (error) => error instanceof ApiError && error.status === 422 && error.code === 'CHAPTER_BODY_INVALID'
  );
  await assert.rejects(
    applySemanticOperation(chapter, { type: 'chapter.replaceDocument', document: { ...chapter, checkpoints: { invalid: true } } }),
    (error) => error instanceof ApiError && error.status === 422 && error.code === 'VALIDATION_FAILED'
      && error.details?.errors?.some((item) => item.code === 'CHECKPOINT_COLLECTION_INVALID')
  );
});

test('locked legacy anchorPassageId values satisfy checkpoint anchor validation', () => {
  const chapter = baseChapter();
  chapter.body.push({ type: 'legacyMarkup', blockId: 'b-legacy-anchor', anchorPassageId: 'p-legacy-anchor', locked: true, sanitizedHtml: '<aside>Worked example</aside>', importedFrom: 'git-markdown-v1' });
  chapter.checkpoints.push(checkpoint('legacy-anchor', 'p-legacy-anchor'));
  assert.deepEqual(validateChapter(chapter, { publishable: true }).errors, []);
});

test('media placements live in chapter body with pinned rights/version and complete presentation semantics', async () => {
  const placement = { mediaId: 'media-1', mediaVersionId: 'media-version-1', rightsCaseId: 'rights-1', anchorPassageId: 'p-work', decorative: false, alt: 'A trolley diagram.', caption: 'The standard switch case.', teachingUse: 'Compare outcome and duty-based reasoning.', displayPreset: 'reading', align: 'center', animationPolicy: 'clickToPlay', printPolicy: 'poster', downloadable: false };
  const placed = await applySemanticOperation(baseChapter(), { type: 'media.place', placement, position: { afterBlockId: 'b-work' } });
  const figure = placed.chapter.body[2];
  assert.equal(figure.type, 'mediaFigure');
  assert.match(figure.figureId, /^figure_/);
  assert.equal(figure.mediaVersionId, 'media-version-1');
  assert.equal(placed.chapter.media, undefined);
  const removed = await applySemanticOperation(placed.chapter, { type: 'media.remove', figureId: figure.figureId });
  assert.equal(removed.chapter.body.some((item) => item.type === 'mediaFigure'), false);
  await assert.rejects(applySemanticOperation(removed.chapter, { type: 'media.remove', figureId: 'figure_missing' }), (error) => error instanceof ApiError && error.code === 'MEDIA_PLACEMENT_NOT_FOUND');
});

test('text.replace and block.move preserve every stable identity and legacy markup is locked', async () => {
  const source = baseChapter();
  const idsBefore = { blockId: source.body[1].blockId, passageId: source.body[1].passageId };
  let result = await applySemanticOperation(source, { type: 'text.replace', blockId: 'b-work', text: 'Revised work passage.' });
  assert.deepEqual({ blockId: result.chapter.body[1].blockId, passageId: result.chapter.body[1].passageId }, idsBefore);
  result = await applySemanticOperation(result.chapter, { type: 'block.move', blockId: 'b-work', position: { beforeBlockId: 'b-commit' } });
  assert.equal(result.chapter.body[0].blockId, 'b-work');
  const locked = baseChapter();
  locked.body.push({ type: 'legacyMarkup', blockId: 'legacy-1', passageId: 'legacy-p', html: '<aside>locked</aside>' });
  await assert.rejects(applySemanticOperation(locked, { type: 'text.replace', blockId: 'legacy-1', text: 'replacement' }), (error) => error instanceof ApiError && error.code === 'LEGACY_MARKUP_LOCKED');
});

test('chapter.replaceBody atomically saves a continuous document while preserving stable anchors', async () => {
  const source = baseChapter();
  source.checkpoints = [{ ...checkpoint('commit', 'p-work'), checkpointId: 'checkpoint-1' }];
  source.body.push({ type: 'legacyMarkup', blockId: 'b-legacy', anchorPassageId: 'p-legacy-source', locked: true, sanitizedHtml: '<aside>Legacy</aside>', importedFrom: 'chapter.md' });
  const body = [
    { ...source.body[0], text: 'Revised commit passage.' },
    { ...source.body[1], text: 'Revised work passage.' },
    { type: 'paragraph', text: 'A newly pasted paragraph.' },
    { blockId: 'b-reconcile', preserve: true },
    { blockId: 'b-legacy', preserve: true }
  ];
  const result = await applySemanticOperation(source, { type: 'chapter.replaceBody', body });
  assert.equal(result.chapter.body[0].blockId, 'b-commit');
  assert.equal(result.chapter.body[1].passageId, 'p-work');
  assert.equal(result.chapter.body[2].text, 'A newly pasted paragraph.');
  assert.match(result.chapter.body[2].blockId, /^block_/);
  assert.equal(result.chapter.body.at(-1).sanitizedHtml, '<aside>Legacy</aside>');
  assert.equal(result.chapter.body.at(-1).anchorPassageId, 'p-legacy-source');
  assert.equal(result.chapter.checkpoints[0].passageExcerptHash, await sha256('Revised work passage.'));
});

test('chapter.replaceBody repairs a browser-split editable ID and allows new prose before the first stable block', async () => {
  const source = baseChapter();
  const result = await applySemanticOperation(source, { type: 'chapter.replaceBody', body: [
    { blockId: 'b-commit', type: 'paragraph', text: 'Test' },
    { blockId: 'b-commit', type: 'paragraph', text: 'Commit passage.' },
    ...source.body.slice(1)
  ] });
  assert.equal(result.chapter.body[0].text, 'Test');
  assert.match(result.chapter.body[0].blockId, /^block_/);
  assert.notEqual(result.chapter.body[0].blockId, 'b-commit');
  assert.equal(result.chapter.body[1].blockId, 'b-commit');
  assert.equal(result.chapter.body[1].passageId, 'p-commit');
  assert.equal(result.chapter.body[1].text, 'Commit passage.');
});

test('chapter.importPlainText replaces all prose while preserving and reanchoring managed content and checkpoints', async () => {
  const source = baseChapter();
  source.checkpoints = [{ ...checkpoint('commit', 'p-reconcile'), checkpointId: 'checkpoint-1' }];
  source.managedPlacements = [{ placementId: 'placement-1', kind: 'personFeature', contentId: 'feature-1', anchorPassageId: 'p-work', position: 'after', orderAtAnchor: 0, displayPreset: 'thinker-card' }];
  source.body.splice(2, 0, { type: 'legacyMarkup', blockId: 'b-legacy', locked: true, sanitizedHtml: '<aside>Managed</aside>', importedFrom: 'chapter.md' });
  const result = await applySemanticOperation(source, { type: 'chapter.importPlainText', paragraphs: ['A complete replacement chapter.'] });
  assert.equal(result.chapter.body.filter((block) => block.type === 'paragraph').length, 1);
  assert.equal(result.chapter.body.find((block) => block.type === 'legacyMarkup').sanitizedHtml, '<aside>Managed</aside>');
  assert.equal(result.chapter.checkpoints[0].passageId, 'p-commit');
  assert.equal(result.chapter.checkpoints[0].passageExcerptHash, await sha256('A complete replacement chapter.'));
  assert.equal(result.chapter.managedPlacements[0].anchorPassageId, 'p-commit');
});

test('chapter.replaceBody still rejects duplicate managed block identities', async () => {
  const source = baseChapter();
  source.body.push({ type: 'legacyMarkup', blockId: 'b-legacy', locked: true, sanitizedHtml: '<aside>Legacy</aside>', importedFrom: 'chapter.md' });
  await assert.rejects(applySemanticOperation(source, { type: 'chapter.replaceBody', body: [
    ...source.body.slice(0, -1),
    { blockId: 'b-legacy', preserve: true },
    { blockId: 'b-legacy', preserve: true }
  ] }), (error) => error instanceof ApiError && error.code === 'BLOCK_ID_DUPLICATE');
});

test('chapter.replaceBody applies visual paragraph, heading, quote, callout, and list style changes', async () => {
  const source = baseChapter();
  const styled = await applySemanticOperation(source, { type: 'chapter.replaceBody', body: [
    { blockId: 'b-commit', type: 'heading', level: 2, text: 'A real heading' },
    { blockId: 'b-work', type: 'list', ordered: false, items: ['First reason', 'Second reason'] },
    { blockId: 'b-reconcile', type: 'blockquote', text: 'A quoted objection.' }
  ] });
  assert.deepEqual(styled.chapter.body.map((block) => block.type), ['heading', 'list', 'blockquote']);
  assert.equal(styled.chapter.body[0].blockId, 'b-commit');
  assert.match(styled.chapter.body[0].sectionId, /^section_/);
  assert.equal(styled.chapter.body[1].passageId, 'p-work');
  assert.deepEqual(styled.chapter.body[1].items, ['First reason', 'Second reason']);
  assert.equal(styled.chapter.body[2].passageId, 'p-reconcile');
});

test('chapter.replaceBody refuses client IDs, altered locked content, and orphaned anchors', async () => {
  const source = baseChapter();
  source.checkpoints = [{ ...checkpoint('commit', 'p-work'), checkpointId: 'checkpoint-1' }];
  await assert.rejects(applySemanticOperation(source, { type: 'chapter.replaceBody', body: [{ blockId: 'not-real', type: 'paragraph', text: 'No.' }] }), (error) => error instanceof ApiError && error.code === 'CLIENT_ASSIGNED_ID_FORBIDDEN');
  await assert.rejects(applySemanticOperation(source, { type: 'chapter.replaceBody', body: source.body.filter((item) => item.blockId !== 'b-work').map((item) => ({ blockId: item.blockId, preserve: true })) }), (error) => error instanceof ApiError && error.code === 'DEPENDENCIES_REQUIRE_REANCHOR');
  const locked = baseChapter();
  locked.body.push({ type: 'legacyMarkup', blockId: 'b-legacy', locked: true, sanitizedHtml: '<aside>Legacy</aside>', importedFrom: 'chapter.md' });
  await assert.rejects(applySemanticOperation(locked, { type: 'chapter.replaceBody', body: [...locked.body.slice(0, -1), { blockId: 'b-legacy', preserve: true, type: 'legacyMarkup' }] }), (error) => error instanceof ApiError && error.code === 'UNKNOWN_FIELD' && error.details.fields.includes('type'));
  await assert.rejects(applySemanticOperation(locked, { type: 'chapter.replaceBody', body: [...locked.body.slice(0, -1), { blockId: 'b-legacy', type: 'paragraph', text: 'Changed.' }] }), (error) => error instanceof ApiError && error.code === 'STRUCTURED_BLOCK_REQUIRES_PRESERVE');
});

test('block.insert creates deterministic unique IDs from a stable anchor and rejects raw markup', async () => {
  const operation = { type: 'block.insert', block: { type: 'callout', tone: 'question', text: 'What assumption changes the result?' }, position: { afterBlockId: 'b-work' } };
  const first = await applySemanticOperation(baseChapter(), operation);
  const second = await applySemanticOperation(baseChapter(), operation);
  assert.equal(first.chapter.body[2].blockId, second.chapter.body[2].blockId);
  assert.match(first.chapter.body[2].passageId, /^passage_/);
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'block.insert', block: { type: 'legacyMarkup', html: '<script>x</script>' }, position: { afterBlockId: 'b-work' } }), (error) => error instanceof ApiError && error.code === 'BLOCK_TYPE_FORBIDDEN');
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'block.insert', block: { type: 'paragraph', text: '<style>body{display:none}</style>' }, position: { afterBlockId: 'b-work' } }), (error) => error instanceof ApiError && error.code === 'RAW_MARKUP_FORBIDDEN');
});

test('block.remove fails closed on anchored dependents and atomically reanchors when explicit', async () => {
  const chapter = baseChapter();
  chapter.checkpoints = [{ ...checkpoint('commit', 'p-work'), checkpointId: 'checkpoint-1' }];
  chapter.body.push({ type: 'externalEmbed', blockId: 'b-embed', embedId: 'embed-1', anchorPassageId: 'p-work', identity: { provider: 'youtube', resourceType: 'video', resourceId: 'abc123' }, canonicalUrl: 'https://www.youtube.com/watch?v=abc123', caption: 'Video', teachingUse: 'Compare.', displayPreset: 'reading', theme: 'auto', options: { provider: 'youtube', captions: true }, fallback: { title: 'Video', summary: 'Summary', linkLabel: 'Open', accessedAt: '2026-08-03T00:00:00Z' }, adapterVersion: 'youtube-v1' });
  chapter.body.push({ type: 'legacyMarkup', blockId: 'b-legacy', locked: true, sanitizedHtml: '<aside>Legacy</aside>', importedFrom: 'chapter.md' });
  await assert.rejects(() => applySemanticOperation(chapter, { type: 'block.remove', blockId: 'b-work' }), (error) => error instanceof ApiError && error.code === 'DEPENDENCIES_REQUIRE_REANCHOR');
  const result = await applySemanticOperation(chapter, { type: 'block.remove', blockId: 'b-work', replacementPassageId: 'p-commit' });
  assert.equal(result.chapter.body.some((item) => item.blockId === 'b-work'), false);
  assert.equal(result.chapter.checkpoints[0].passageId, 'p-commit');
  assert.equal(result.chapter.checkpoints[0].passageExcerptHash, await sha256('Commit passage.'));
  assert.equal(result.chapter.body.find((item) => item.blockId === 'b-embed').anchorPassageId, 'p-commit');
  await assert.rejects(() => applySemanticOperation(chapter, { type: 'block.remove', blockId: 'b-legacy' }), (error) => error instanceof ApiError && error.code === 'LEGACY_MARKUP_LOCKED');
});

test('checkpoint.remove targets either the internal key or stable ID', async () => {
  const added = await applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: checkpoint('commit', 'p-commit') });
  const id = added.chapter.checkpoints[0].checkpointId;
  await assert.rejects(applySemanticOperation(added.chapter, { type: 'checkpoint.remove', checkpointId: 'wrong' }), (error) => error instanceof ApiError && error.code === 'CHECKPOINT_NOT_FOUND');
  const removed = await applySemanticOperation(added.chapter, { type: 'checkpoint.remove', checkpointId: id });
  assert.equal(removed.chapter.checkpoints.length, 0);
});

test('embed.upsert requires provider-bound HTTPS identity and authored fallback without executable markup', async () => {
  const embed = { kind: 'externalEmbed', identity: { provider: 'youtube', resourceType: 'video', resourceId: 'abc123' }, canonicalUrl: 'https://www.youtube.com/watch?v=abc123', caption: 'A short account of the case.', teachingUse: 'Identify the speaker’s central claim.', displayPreset: 'reading', theme: 'auto', fallback: { title: 'Video account', summary: 'A fallback account of the argument.', linkLabel: 'Open the video', accessedAt: '2026-08-03' }, adapterVersion: 'youtube-v1' };
  const inserted = await applySemanticOperation(baseChapter(), { type: 'embed.upsert', embed, position: { afterBlockId: 'b-commit' } });
  assert.equal(inserted.chapter.body[1].type, 'externalEmbed');
  assert.match(inserted.chapter.body[1].embedId, /^embed_/);
  assert.deepEqual(inserted.chapter.body[1].options, { captions: true });
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'embed.upsert', embed: { ...embed, canonicalUrl: 'https://vimeo.com/123' }, position: { afterBlockId: 'b-commit' } }), (error) => error instanceof ApiError && error.code === 'PROVIDER_IDENTITY_MISMATCH');
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'embed.upsert', embed: { ...embed, identity: { ...embed.identity, resourceType: 'post' } }, position: { afterBlockId: 'b-commit' } }), (error) => error instanceof ApiError && error.code === 'PROVIDER_IDENTITY_INVALID');
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'embed.upsert', embed: { ...embed, adapterVersion: 'caller-selected-v99' }, position: { afterBlockId: 'b-commit' } }), (error) => error instanceof ApiError && error.code === 'ADAPTER_VERSION_INVALID');
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'embed.upsert', embed: { ...embed, fallback: { ...embed.fallback, summary: '<script>alert(1)</script>' } }, position: { afterBlockId: 'b-commit' } }), (error) => error instanceof ApiError && error.code === 'RAW_MARKUP_FORBIDDEN');
  const soundcloud = { ...embed, identity: { provider: 'soundcloud', resourceType: 'track', resourceId: 'same-slug' }, canonicalUrl: 'https://soundcloud.com/creator-one/same-slug', adapterVersion: 'soundcloud-v1' };
  const firstCreator = await applySemanticOperation(baseChapter(), { type: 'embed.upsert', embed: soundcloud, position: { afterBlockId: 'b-commit' } });
  const secondCreator = await applySemanticOperation(baseChapter(), { type: 'embed.upsert', embed: { ...soundcloud, canonicalUrl: 'https://soundcloud.com/creator-two/same-slug' }, position: { afterBlockId: 'b-commit' } });
  assert.notEqual(firstCreator.chapter.body[1].embedId, secondCreator.chapter.body[1].embedId);
  assert.deepEqual(firstCreator.chapter.body[1].options, { linkFirst: true });
});

test('richLink uses an authored public-HTTPS fallback and rejects local targets', async () => {
  const embed = { kind: 'richLink', canonicalUrl: 'https://example.org/ethics/case', title: 'Case source', summary: 'A source presenting the case evidence.', teachingUse: 'Compare the source framing with the chapter.', linkLabel: 'Read the source', accessedAt: '2026-08-03' };
  const inserted = await applySemanticOperation(baseChapter(), { type: 'embed.upsert', embed, position: { beforeBlockId: 'b-reconcile' } });
  assert.equal(inserted.chapter.body[2].type, 'richLink');
  assert.match(inserted.chapter.body[2].linkId, /^link_/);
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'embed.upsert', embed: { ...embed, canonicalUrl: 'https://localhost/internal' }, position: { beforeBlockId: 'b-reconcile' } }), (error) => error instanceof ApiError && error.code === 'URL_NOT_PUBLIC_HTTPS');
});

test('operation schemas expose exact required and optional top-level payload fields', () => {
  assert.deepEqual(OPERATION_PAYLOAD_SCHEMAS['text.replace'], { required: ['type', 'blockId', 'text'], optional: [] });
  assert.deepEqual(OPERATION_PAYLOAD_SCHEMAS['chapter.replaceBody'], { required: ['type', 'body'], optional: [] });
  assert.deepEqual(OPERATION_PAYLOAD_SCHEMAS['chapter.importPlainText'], { required: ['type', 'paragraphs'], optional: [] });
  assert.deepEqual(OPERATION_PAYLOAD_SCHEMAS['block.remove'], { required: ['type', 'blockId'], optional: ['replacementPassageId'] });
  assert.deepEqual(OPERATION_PAYLOAD_SCHEMAS['checkpoint.remove'], { required: ['type'], optional: ['slot', 'slotLabel', 'checkpointId'] });
  assert.deepEqual(OPERATION_PAYLOAD_SCHEMAS['media.place'], { required: ['type', 'placement'], optional: ['position'] });
});

test('Worker serves the versioned operation envelope to authenticated readers without database access', async () => {
  const headers = gatewayHeaders('content:read');
  const response = await worker.fetch(new Request('https://content.example/v1/schema', { headers }), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.changesets.saveLive.route, 'POST /v1/changesets/{changesetId}:saveLive');
  assert.equal(body.changesets.saveLive.result, 'new immutable canonical revision visible on the public reader');
  assert.equal(body.changesets.saveLive.agentAdditionalScope, 'content:live-save');
  assert.deepEqual(body.mutationEnvelope.required, ['baseRevisionId', 'expectedVersion', 'idempotencyKey', 'operation']);
  assert.deepEqual(body.operations['embed.upsert'].required, ['type', 'embed']);
  assert.equal(body.media.requestUpload.route, 'POST /v1/media:requestUpload');
  assert.equal(body.media.requestUpload.policy.totalStorageLimitBytes, 8 * 1024 * 1024 * 1024);
  assert.equal(body.media.requestUpload.transcriptEquivalent.timedCaptionTrackClaimed, false);
  assert.equal(body.media.reviewPackage.decide.humanActorRequired, true);
  assert.equal(body.media.search.query.limit, '1-50');
  assert.equal(body.providers.resolve.networkAccess, false);
  assert.equal(body.reads.dependencies.route, 'GET /v1/chapters/{chapterId}/dependencies');
  assert.equal(body.reads.dependencies.query.passageId, 'optional stable passage ID');
  assert.equal(body.release.asset.requiresExactReleaseApproval, true);
  assert.equal(body.rateLimits.persistence, 'D1 fail-closed');
  assert.equal(body.authority.activateBatch.route, 'POST /v1/authority:activateD1');
  assert.equal(body.authority.activateBatch.databaseGuarded, true);
  assert.equal(body.authority.canaryCompatibility.fixedDocumentId, 'chapter_ch07');
  assert.equal(body.review.diff.route, 'POST /v1/changesets/{changesetId}:diff');
  assert.equal(body.review.reject.scope, 'content:approve');
  assert.equal(body.review.approve.humanActorRequired, true);
  assert.equal(body.review.restoreAsDraft.route, 'POST /v1/chapters/{chapterId}/revisions/{revisionId}:restoreAsDraft');
  assert.equal(body.release.snapshot.scope, 'content:releaseSnapshot');
  assert.equal(body.release.metadata.route, 'GET /v1/releases/{releaseId}');
  assert.equal(body.release.publish.humanActorRequired, true);
  assert.equal(body.release.publish.enabled, false);
});

test('media upload policy accepts supported bounded files and fails closed on MIME, captions, and budgets', () => {
  const valid = { filename: 'case.gif', mimeType: 'image/gif', bytes: 1024, sha256: 'a'.repeat(64), idempotencyKey: 'upload-key-123', reviewPackageId: `reviewpkg_${'a'.repeat(24)}` };
  const upload = validateUploadRequest(valid);
  assert.equal(upload.storageReservationBytes, 4096 + 1024 * 1024);
  assert.equal(upload.maxBytes, 25 * 1024 * 1024);
  assert.throws(() => validateUploadRequest({ ...valid, mimeType: 'image/svg+xml' }), (error) => error instanceof ApiError && error.code === 'MIME_NOT_SUPPORTED');
  assert.throws(() => validateUploadRequest({ ...valid, filename: 'clip.mp4', mimeType: 'video/mp4' }), (error) => error instanceof ApiError && error.code === 'TRANSCRIPT_EQUIVALENT_REQUIRED');
  assert.throws(() => assertMediaBudget({ storedBytes: MEDIA_UPLOAD_POLICY.totalStorageLimitBytes - 1024, reservedStorageBytes: 0, monthlyIngestedBytes: 0, monthlyReservedBytes: 0 }, upload), (error) => error instanceof ApiError && error.code === 'STORAGE_BUDGET_EXCEEDED');
  assert.throws(() => assertMediaBudget({ storedBytes: 0, reservedStorageBytes: 0, monthlyIngestedBytes: MEDIA_UPLOAD_POLICY.monthlyIngestLimitBytes, monthlyReservedBytes: 0 }, upload), (error) => error instanceof ApiError && error.code === 'MONTHLY_INGEST_BUDGET_EXCEEDED');
});

test('release projection classifies plain text as a document and preserves WebM and WAV kinds', () => {
  assert.equal(releaseMediaKind('text/plain', {}), 'document');
  assert.equal(releaseMediaKind('video/webm', {}), 'video');
  assert.equal(releaseMediaKind('audio/wav', {}), 'audio');
});

test('private originals bind exact uploaded hash and bytes without becoming release objects', async () => {
  const descriptor = { file: 'original.gif', private: true, sha256: 'a'.repeat(64), bytes: 1024 };
  assert.equal(validatePrivateOriginal(descriptor, { sourceSha256: 'a'.repeat(64), sourceBytes: 1024 }), descriptor);
  assert.throws(() => validatePrivateOriginal({ ...descriptor, file: '../original.gif' }, { sourceSha256: 'a'.repeat(64), sourceBytes: 1024 }), (error) => error instanceof ApiError && error.code === 'ORIGINAL_OBJECT_INVALID');
  assert.throws(() => validatePrivateOriginal({ ...descriptor, sha256: 'b'.repeat(64) }, { sourceSha256: 'a'.repeat(64), sourceBytes: 1024 }), (error) => error instanceof ApiError && error.code === 'ORIGINAL_OBJECT_INVALID');
  const migration = await readFile(new URL('../../workers/content-api/migrations/0008_media_original_objects.sql', import.meta.url), 'utf8');
  assert.match(migration, /private INTEGER NOT NULL DEFAULT 1 CHECK \(private = 1\)/);
  assert.doesNotMatch(migration, /submitted_snapshot_media_assets/);
});

test('processor callback HMAC is canonical and rejects tampering', async () => {
  const secret = 'processor-callback-secret-at-least-32-bytes';
  const raw = stableStringify({ jobId: 'mediajob_123', state: 'ready' });
  const signature = `sha256=${await hmacSha256(secret, raw)}`;
  assert.equal(await verifyHmacSignature(secret, raw, signature), true);
  assert.equal(await verifyHmacSignature(secret, `${raw} `, signature), false);
});

test('revision finalization derives identity from approved editorial hash and hashes server metadata', async () => {
  const editorialContentHash = await sha256(baseChapter());
  const published = await finalizeChapterRevision(baseChapter(), { editorialContentHash, status: 'published', actorId: 'actor_instructor_1', actorType: 'human', updatedAt: '2026-08-03T00:00:00.000Z' });
  const repeated = await finalizeChapterRevision(baseChapter(), { editorialContentHash, status: 'published', actorId: 'actor_instructor_1', actorType: 'human', updatedAt: '2026-08-03T00:00:00.000Z' });
  assert.equal(published.revisionId, `revision_${editorialContentHash.slice(0, 24)}`);
  assert.equal(repeated.contentHash, published.contentHash);
  assert.equal(published.content.revisionId, published.revisionId);
  assert.equal(published.content.chapterVersion, published.revisionId);
  assert.equal(published.content.status, 'published');
  assert.deepEqual(published.content.updatedBy, { actorId: 'actor_instructor_1', actorType: 'human' });
  assert.notEqual(editorialContentHash, published.contentHash);
});

test('media upload request rejects missing private bindings before accepting data', async () => {
  const response = await worker.fetch(new Request('https://content.example/v1/media:requestUpload', { method: 'POST', headers: agentHeaders(), body: '{}' }), withAgentCapability({}, { scopes: ['media:upload'] }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'MEDIA_BINDING_UNAVAILABLE');
});

test('authority batch activation is service-only and binds exact canonical heads to the active release', async () => {
  const contentA = { ...baseChapter(), chapterId: 'chapter_ch07', revisionId: 'revision-a', chapterVersion: 'revision-a', status: 'published' };
  const contentB = { ...baseChapter(), chapterId: 'chapter_ch08', revisionId: 'revision-b', chapterVersion: 'revision-b', status: 'published' };
  const entries = {
    chapter_ch07: { sourceRevision: 'revision-a', baseRevision: 'revision-base-a', content: contentA, hash: await sha256(contentA) },
    chapter_ch08: { sourceRevision: 'revision-b', baseRevision: 'revision-base-b', content: contentB, hash: await sha256(contentB) }
  };
  const submittedSnapshot = { schemaVersion: 2, changesetId: 'changeset-live', documents: Object.entries(entries).map(([documentId, item]) => ({ documentId, baseRevisionId: item.baseRevision, revisionId: item.sourceRevision, submittedContentHash: item.hash, content: item.content })) };
  const snapshotText = stableStringify(submittedSnapshot);
  const snapshotHash = await sha256(snapshotText);
  const CONTENT_DB = fakeDb((sql, args) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM release_pointers')) return { release_id: 'release-live' };
    if (sql.includes('FROM releases r JOIN submitted_snapshots')) return { snapshot_hash: snapshotHash, r2_object_key: 'submitted/live.json', changeset_id: 'changeset-live' };
    if (sql.includes('FROM documents WHERE id')) return { id: args[0], current_revision_id: entries[args[0]].baseRevision, current_content_hash: '0'.repeat(64) };
    if (sql.includes('FROM release_authority_entries')) return { authority: 'd1', source_revision: entries[args[1]].sourceRevision, normalized_snapshot_hash: entries[args[1]].hash };
    if (sql.includes('FROM authority_registry')) return { authority: 'git' };
    if (sql.includes('FROM document_revisions')) return null;
    return null;
  });
  const CONTENT_SNAPSHOTS = { get: async (key) => key === 'submitted/live.json' ? { text: async () => snapshotText } : null };
  const headers = { 'content-type': 'application/json', 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_release_workflow', 'x-content-actor-type': 'service', 'x-content-client-id': 'github-content-release', 'x-content-run-id': '123456', 'x-content-scopes': 'content:authority' };
  const requestBody = { releaseId: 'release-live', documents: Object.entries(entries).map(([documentId, item]) => ({ documentId, sourceRevision: item.sourceRevision, normalizedSnapshotHash: item.hash })), idempotencyKey: 'authority-cutover-key-1' };
  let response = await worker.fetch(new Request('https://content.example/v1/authority:activateD1', { method: 'POST', headers, body: JSON.stringify(requestBody) }), { CONTENT_DB, CONTENT_SNAPSHOTS });
  const text = await response.text(); assert.equal(response.status, 201, text); const body = JSON.parse(text);
  assert.deepEqual(body.activated.map((item) => item.documentId), ['chapter_ch07', 'chapter_ch08']);
  assert.equal(body.activated.every((item) => item.headPromoted), true);
  assert.equal(CONTENT_DB.batchItems.filter((item) => item.sql.includes('INSERT INTO document_revisions')).length, 2);
  assert.equal(CONTENT_DB.batchItems.filter((item) => item.sql.includes('UPDATE documents SET current_revision_id')).length, 2);
  assert.equal(CONTENT_DB.batchItems.filter((item) => item.sql.includes('INSERT INTO authority_registry')).length, 2);
  assert.equal(CONTENT_DB.batchItems.filter((item) => item.sql.includes('INSERT INTO public_chapter_projections')).length, 2);
  assert.equal(CONTENT_DB.batchItems.filter((item) => item.sql.includes('INSERT INTO public_chapter_heads')).length, 2);
  response = await worker.fetch(new Request('https://content.example/v1/authority:activateD1', { method: 'POST', headers: agentHeaders(), body: JSON.stringify({ ...requestBody, idempotencyKey: 'authority-cutover-key-2' }) }), withAgentCapability({ CONTENT_DB, CONTENT_SNAPSHOTS }, { scopes: ['content:authority'] }));
  assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'RELEASE_WORKFLOW_REQUIRED');
  const staleDb = fakeDb((sql) => sql.includes('FROM idempotency_records') ? null : sql.includes('FROM release_pointers') ? { release_id: 'release-newer' } : null);
  response = await worker.fetch(new Request('https://content.example/v1/authority:activateD1', { method: 'POST', headers, body: JSON.stringify({ ...requestBody, idempotencyKey: 'authority-cutover-key-3' }) }), { CONTENT_DB: staleDb, CONTENT_SNAPSHOTS });
  assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'ACTIVE_RELEASE_CONFLICT');
});

test('authority activation preserves a verified instructor live-save lineage during a code-only release', async () => {
  const content = { ...baseChapter(), chapterId: 'chapter_ch07', revisionId: 'revision-release', chapterVersion: 'revision-release', status: 'published' };
  const contentHash = await sha256(content);
  const submittedSnapshot = { schemaVersion: 2, changesetId: 'changeset-code-only', documents: [{ documentId: 'chapter_ch07', baseRevisionId: 'revision-base', revisionId: 'revision-release', submittedContentHash: contentHash, content }] };
  const snapshotText = stableStringify(submittedSnapshot);
  const snapshotHash = await sha256(snapshotText);
  const lineage = [
    { id: 'revision-live-2', parent_revision_id: 'revision-live-1', content_hash: 'live-hash-2', metadata_json: JSON.stringify({ status: 'published', publicationMode: 'instructor-live-save' }), depth: 0 },
    { id: 'revision-live-1', parent_revision_id: 'revision-release', content_hash: 'live-hash-1', metadata_json: JSON.stringify({ status: 'published', publicationMode: 'instructor-live-save' }), depth: 1 },
    { id: 'revision-release', parent_revision_id: 'revision-base', content_hash: contentHash, metadata_json: '{}', depth: 2 }
  ];
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM release_pointers')) return { release_id: 'release-code-only' };
    if (sql.includes('FROM releases r JOIN submitted_snapshots')) return { snapshot_hash: snapshotHash, r2_object_key: 'submitted/code-only.json', changeset_id: 'changeset-code-only' };
    if (sql.includes('FROM documents WHERE id')) return { id: 'chapter_ch07', current_revision_id: 'revision-live-2', current_content_hash: 'live-hash-2' };
    if (sql.includes('WITH RECURSIVE lineage')) return { results: lineage };
    if (sql.includes('FROM release_authority_entries')) return { authority: 'd1', source_revision: 'revision-release', normalized_snapshot_hash: contentHash };
    if (sql.includes('FROM authority_registry')) return { authority: 'd1', source_revision: 'revision-live-2', normalized_snapshot_hash: 'live-hash-2' };
    if (sql.includes('FROM document_revisions')) return { document_id: 'chapter_ch07', content_hash: contentHash };
    return null;
  });
  const CONTENT_SNAPSHOTS = { get: async () => ({ text: async () => snapshotText }) };
  const headers = { 'content-type': 'application/json', 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_release_workflow', 'x-content-actor-type': 'service', 'x-content-client-id': 'github-content-release', 'x-content-run-id': 'code-only-run', 'x-content-scopes': 'content:authority' };
  const requestBody = { releaseId: 'release-code-only', documents: [{ documentId: 'chapter_ch07', sourceRevision: 'revision-release', normalizedSnapshotHash: contentHash }], idempotencyKey: 'authority-code-only-key' };
  const response = await worker.fetch(new Request('https://content.example/v1/authority:activateD1', { method: 'POST', headers, body: JSON.stringify(requestBody) }), { CONTENT_DB, CONTENT_SNAPSHOTS });
  const result = await response.json(); assert.equal(response.status, 201, JSON.stringify(result));
  assert.equal(result.activated[0].liveAdvance, true);
  assert.equal(result.activated[0].liveRevisionCount, 2);
  assert.equal(result.activated[0].headPromoted, false);
  assert.equal(CONTENT_DB.batchItems.some((item) => item.sql.includes('UPDATE documents SET current_revision_id')), false);
  assert.equal(CONTENT_DB.batchItems.some((item) => item.sql.includes('INSERT INTO authority_registry')), false);
  assert.equal(CONTENT_DB.batchItems.some((item) => item.sql.includes('INSERT INTO public_chapter_heads')), false);
});

test('processor callback rejects tampered HMAC before touching D1 and canary route is fixed to Chapter 7', async () => {
  let response = await worker.fetch(new Request('https://content.example/v1/media:processorCallback', { method: 'POST', headers: { 'content-type': 'application/json', 'x-media-signature': `sha256=${'0'.repeat(64)}` }, body: '{}' }), { CONTENT_DB: {}, CONTENT_MEDIA: {}, MEDIA_CALLBACK_SECRET: 'processor-callback-secret-at-least-32-bytes' });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'CALLBACK_SIGNATURE_INVALID');
  const headers = { 'content-type': 'application/json', 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_operator_1', 'x-content-actor-type': 'human', 'x-content-client-id': 'studio', 'x-content-run-id': 'run-1', 'x-content-scopes': 'content:authority' };
  response = await worker.fetch(new Request('https://content.example/v1/authority/chapter_ch08:activateD1', { method: 'POST', headers, body: '{}' }), {});
  assert.equal(response.status, 404);
});

test('media workflow consumes an immutable R2 envelope and preserves fail-closed scanning', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/media-process.yml', import.meta.url), 'utf8');
  assert.match(workflow, /envelope_sha256:/);
  assert.match(workflow, /R2_JOB_BUCKET/);
  assert.match(workflow, /sha256sum --check --status/);
  assert.match(workflow, /MEDIA_REQUIRE_MALWARE_SCAN: '1'/);
  assert.match(workflow, /repository_dispatch:/);
  assert.match(workflow, /types: \[media_process\]/);
  assert.match(workflow, /github\.event\.client_payload\.envelope_sha256/);
  assert.doesNotMatch(workflow, /envelope_path:/);
});

test('gateway identity ignores client body and requires exact trusted headers', () => {
  const request = new Request('https://content.example/v1/chapters', { headers: { 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_instructor_1', 'x-content-actor-type': 'human', 'x-content-client-id': 'studio', 'x-content-run-id': 'run-1', 'x-content-scopes': 'content:read content:write' } });
  const identity = trustedIdentity(request);
  assert.equal(identity.actorId, 'actor_instructor_1');
  assert.equal(identity.actorType, 'human');
  assert.deepEqual([...identity.scopes], ['content:read', 'content:write']);
  assert.throws(() => trustedIdentity(new Request('https://content.example/v1/chapters', { headers: { 'x-content-actor-id': 'forged' } })), (error) => error instanceof ApiError && error.code === 'UNAUTHENTICATED');
});

test('Worker rejects unauthenticated, under-scoped, forged-actor, and oversized requests consistently', async () => {
  let response = await worker.fetch(new Request('https://content.example/v1/chapters'), {});
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');

  const readHeaders = agentHeaders();
  const agentEnv = withAgentCapability({}, { scopes: ['content:write'], allowedDocumentIds: ['chapter-07'], allowedOperations: ['create_or_resume_changeset'] });
  response = await worker.fetch(new Request('https://content.example/v1/chapters', { headers: readHeaders }), agentEnv);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN');

  const mutationHeaders = { ...readHeaders, 'content-type': 'application/json', 'content-length': '200000' };
  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/changesets', { method: 'POST', headers: mutationHeaders, body: JSON.stringify({ actorId: 'forged' }) }), agentEnv);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'BODY_TOO_LARGE');

  delete mutationHeaders['content-length'];
  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/changesets', { method: 'POST', headers: mutationHeaders, body: JSON.stringify({ actorId: 'forged' }) }), agentEnv);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'UNKNOWN_FIELD');
});

test('agent capabilities fail closed for missing, revoked, mismatched, or out-of-target authority', async () => {
  const assertedAgent = { 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_agent_1', 'x-content-actor-type': 'agent', 'x-content-client-id': 'mcp', 'x-content-run-id': 'run-1', 'x-content-scopes': 'content:read' };
  let response = await worker.fetch(new Request('https://content.example/v1/schema', { headers: assertedAgent }), {});
  assert.equal(response.status, 401); assert.equal((await response.json()).error.code, 'AGENT_CAPABILITY_REQUIRED');

  response = await worker.fetch(new Request('https://content.example/v1/schema', { headers: { authorization: 'Bearer revoked' } }), { AUTH_CAPABILITY: { verifyCapability: async () => { throw new Error('revoked'); } } });
  assert.equal(response.status, 401); assert.equal((await response.json()).error.code, 'INVALID_CAPABILITY');

  response = await worker.fetch(new Request('https://content.example/v1/schema', { headers: { authorization: 'Bearer test-agent-capability', ...assertedAgent, 'x-content-actor-id': 'actor_forged' } }), withAgentCapability({}, { scopes: ['content:read'] }));
  assert.equal(response.status, 401); assert.equal((await response.json()).error.code, 'CAPABILITY_IDENTITY_MISMATCH');

  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter_ch07/authoring-view', { headers: agentHeaders() }), withAgentCapability({}, { scopes: ['content:read'], allowedDocumentIds: ['chapter_ch08'], allowedOperations: ['get_authoring_view'] }));
  assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'CAPABILITY_DOCUMENT_FORBIDDEN');

  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter_ch07/changesets', { method: 'POST', headers: agentHeaders(), body: '{}' }), withAgentCapability({}, { scopes: ['content:write'], allowedDocumentIds: ['chapter_ch07'], allowedOperations: ['text.replace'] }));
  assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'CAPABILITY_OPERATION_FORBIDDEN');
});

test('audited runtime flags gate the unified editor per chapter before private content reads', async () => {
  const CONTENT_DB = fakeDb((sql, args) => {
    if (sql.includes('FROM runtime_feature_flags')) {
      assert.deepEqual(args, ['unified_editor']);
      return { enabled: 0, document_ids_json: '["chapter_ch07"]', version: 1 };
    }
    throw new Error('private content should not be read while the editor flag is disabled');
  });
  const response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter_ch07/authoring-view', { headers: gatewayHeaders('content:read') }), { CONTENT_DB, RUNTIME_FLAGS_ENFORCED: '1' });
  assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'FEATURE_DISABLED');
});

test('Wrangler binding declaration separates each private R2 concern and both queue DLQs', async () => {
  const config = await readFile(new URL('../../workers/content-api/wrangler.jsonc', import.meta.url), 'utf8');
  for (const binding of ['CONTENT_MEDIA', 'UPLOAD_QUARANTINE', 'CONTENT_SNAPSHOTS', 'RELEASE_ARTIFACTS', 'CONTENT_BACKUPS', 'MEDIA_JOB_ENVELOPES', 'MEDIA_JOBS', 'RELEASE_JOBS']) assert.match(config, new RegExp(`\\"${binding}\\"`));
  assert.match(config, /"binding": "PUBLIC_READER_DELIVERY", "service": "ethicsandai", "entrypoint": "DeliveryIdentity"/);
  assert.doesNotMatch(config, /"binding": "PUBLIC_READER"/);
  assert.match(config, /ai-ethics-media-jobs-dlq/);
  assert.match(config, /ai-ethics-release-jobs-dlq/);
  assert.doesNotMatch(config, /"consumers"\s*:/);
  assert.match(config, /"workers_dev": false/);
  assert.doesNotMatch(config, /"routes"\s*:/);
});

test('stable hashes and IDs do not depend on object insertion order', async () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(await sha256({ b: 2, a: 1 }), await sha256({ a: 1, b: 2 }));
  assert.equal(await deterministicId('cs', { a: 1 }), await deterministicId('cs', { a: 1 }));
});

test('CAS rejects stale working versions and base revisions', () => {
  assert.throws(() => assertCas({ expectedVersion: 1, actualVersion: 2 }), (error) => error instanceof ConflictError && error.code === 'stale_working_document');
  assert.throws(() => assertCas({ expectedRevisionId: 'rev-1', actualRevisionId: 'rev-2' }), (error) => error instanceof ConflictError && error.code === 'stale_base_revision');
});

test('draft checkpoints increment version and retain a content hash', async () => {
  const next = await checkpointDraft({ version: 4, checkpoint: 2, content: 'old' }, { content: 'new', actorId: 'joel', expectedVersion: 4 });
  assert.equal(next.version, 5);
  assert.equal(next.checkpoint, 3);
  assert.equal(next.updated_by, 'joel');
  assert.equal(next.content_hash, await sha256('new'));
});

test('idempotency replays exact requests but rejects key reuse', async () => {
  const fresh = await resolveIdempotency({ existing: null, scope: 's', key: 'k', request: { title: 'A' } });
  assert.equal(fresh.kind, 'new');
  const replay = await resolveIdempotency({ existing: { request_hash: fresh.requestHash, response_status: 201, response_json: '{"id":"cs"}' }, scope: 's', key: 'k', request: { title: 'A' } });
  assert.equal(replay.kind, 'replay');
  await assert.rejects(resolveIdempotency({ existing: { request_hash: fresh.requestHash }, scope: 's', key: 'k', request: { title: 'B' } }), (error) => error instanceof ConflictError && error.code === 'idempotency_key_reused');
});
