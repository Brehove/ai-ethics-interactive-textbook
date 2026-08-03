import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ApiError, ConflictError, MEDIA_UPLOAD_POLICY, OPERATION_PAYLOAD_SCHEMAS, PROVIDER_REGISTRY, applySemanticOperation, assertCas, assertMediaBudget, checkpointDraft, deterministicId, finalizeChapterRevision, hmacSha256, resolveIdempotency, resolveProviderUrl, semanticDiffChapter, sha256, sha256Bytes, stableStringify, trustedIdentity, validateChapter, validateMediaReviewPackage, validateUploadRequest, verifyHmacSignature } from '../../workers/content-api/src/services.mjs';
import worker from '../../workers/content-api/src/index.mjs';

test('health endpoint is dependency-free and reports binding presence', async () => {
  const response = await worker.fetch(new Request('https://content.example/health'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'content-api', db_configured: false, media_configured: false });
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
});

test('changeset diff endpoint returns a structured content-free comparison tied to both hashes', async () => {
  const base = baseChapter();
  const working = structuredClone(base);
  working.body[1].text = 'Changed prose';
  const CONTENT_DB = fakeDb((sql) => sql.includes('FROM changesets c JOIN working_documents') ? {
    state: 'open', document_id: 'chapter-07', base_revision_id: 'revision-base', content_hash: 'working-hash', content_text: JSON.stringify(working), version: 2,
    base_content_hash: 'base-hash', base_content_text: JSON.stringify(base)
  } : null);
  const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs-1:diff', { method: 'POST', headers: gatewayHeaders('content:read') }), { CONTENT_DB });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.baseContentHash, 'base-hash');
  assert.equal(body.workingContentHash, 'working-hash');
  assert.deepEqual(body.diff.blocks.modified, [{ blockId: 'b-work', beforeType: 'paragraph', afterType: 'paragraph', changedFields: ['text'] }]);
  assert.equal(JSON.stringify(body).includes('Changed prose'), false);
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
  const headers = { ...gatewayHeaders('content:approve content:publish'), 'x-content-actor-id': 'actor_automation_1', 'x-content-actor-type': 'agent' };
  for (const action of ['approve', 'reject', 'publish']) {
    const response = await worker.fetch(new Request(`https://content.example/v1/changesets/cs-1:${action}`, { method: 'POST', headers, body: '{}' }), {});
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'HUMAN_ACTOR_REQUIRED');
  }
});

test('restore-as-draft seeds historical content but bases the new changeset on current canonical revision', async () => {
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('JOIN document_revisions target')) return {
      current_revision_id: 'revision-current', current_content_hash: 'current-hash', target_content_hash: 'historical-hash',
      target_content_text: JSON.stringify(baseChapter()), target_r2_object_key: null, target_metadata_json: '{"era":"historical"}'
    };
    return null;
  });
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
});

test('release metadata is reconstructed from frozen snapshot, authority, approvals, and pointer rows', async () => {
  const CONTENT_DB = fakeDb((sql) => {
    if (sql.includes('FROM releases r')) return { id: 'release-1', changeset_id: 'cs-1', state: 'published', manifest_hash: 'a'.repeat(64), snapshot_id: 'snapshot-1', snapshot_hash: 'a'.repeat(64), snapshot_revision: 'snapshotrev-1', snapshot_object_key: `submitted/${'a'.repeat(64)}.json`, snapshot_document_count: 1, snapshot_created_at: '2026-08-03T00:00:00Z' };
    if (sql.includes('FROM release_authority_entries')) return { results: [{ document_id: 'chapter-07', authority: 'd1', source_path: null, source_revision: 'revision-7', normalized_snapshot_hash: 'chapter-hash' }] };
    if (sql.includes('FROM approvals')) return { results: [{ id: 'approval-1', decision_kind: 'release', decision: 'approved', decided_by: 'actor_reviewer_1' }] };
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
  assert.doesNotMatch(query.sql, /Trolley/);
  assert.deepEqual(query.args.slice(-2), [3, 4]);
  const invalid = await worker.fetch(new Request('https://content.example/v1/media?limit=500', { headers }), { CONTENT_DB });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'PAGINATION_INVALID');
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
  const agentHeaders = { ...gatewayHeaders('content:approve'), 'x-content-actor-id': 'actor_review_agent', 'x-content-actor-type': 'agent' };
  response = await worker.fetch(new Request(`https://content.example/v1/media-review-packages/${created.id}:decide`, { method: 'POST', headers: agentHeaders, body: '{}' }), {});
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
    if (sql.includes('SELECT w.*, c.state')) return { id: 'working-1', document_id: 'chapter-07', base_revision_id: 'revision-base', content_hash: editorialHash, content_text: JSON.stringify(chapter), r2_object_key: null, metadata_json: '{}', version: 1, state: 'open', current_revision_id: 'revision-base' };
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
    if (sql.includes('SELECT w.*, c.state')) return { id: 'working-2', document_id: 'chapter-07', base_revision_id: 'revision-base', content_hash: editorialHash, content_text: JSON.stringify(chapter), r2_object_key: null, metadata_json: '{}', version: 1, state: 'open', current_revision_id: 'revision-base' };
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
  slot,
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
  base.checkpoints = [{ checkpointId: 'checkpoint-work', slot: 'work', passageId: 'p-work', passageExcerptHash: 'a'.repeat(64), prompt: 'Original private prose' }];
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
  assert.deepEqual(diff.checkpoints.anchorsChanged, [{ checkpointId: 'checkpoint-work', slot: 'work', beforePassageId: 'p-work', afterPassageId: 'p-reconcile', excerptHashChanged: true }]);
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

test('checkpoint operations preserve immutable Commit-Work-Reconcile order and stable IDs', async () => {
  let result = await applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: checkpoint('reconcile', 'p-reconcile') });
  result = await applySemanticOperation(result.chapter, { type: 'checkpoint.upsert', checkpoint: checkpoint('commit', 'p-commit') });
  result = await applySemanticOperation(result.chapter, { type: 'checkpoint.upsert', checkpoint: checkpoint('work', 'p-work') });
  assert.deepEqual(result.chapter.checkpoints.map((item) => item.slot), ['commit', 'work', 'reconcile']);
  const stableId = result.chapter.checkpoints[1].checkpointId;
  const replacement = checkpoint('work', 'p-reconcile');
  replacement.prompt = 'Revised work prompt';
  result = await applySemanticOperation(result.chapter, { type: 'checkpoint.replace', checkpoint: replacement });
  assert.equal(result.chapter.checkpoints[1].checkpointId, stableId);
  assert.equal(result.chapter.checkpoints[1].passageId, 'p-reconcile');
  assert.deepEqual(validateChapter(result.chapter, { publishable: true }), { valid: true, errors: [] });
});

test('checkpoint validation rejects unstable anchors and incomplete publish sets while sidebar visibility remains editable', async () => {
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: checkpoint('commit', 'missing') }), (error) => error instanceof ApiError && error.code === 'CHECKPOINT_ANCHOR_MISSING');
  const noSidebar = checkpoint('commit', 'p-commit');
  noSidebar.showInSidebar = false;
  const hidden = await applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: noSidebar });
  assert.equal(hidden.chapter.checkpoints[0].showInSidebar, false);
  assert.equal(validateChapter(baseChapter(), { publishable: true }).errors[0].code, 'CHECKPOINT_SEQUENCE_REQUIRED');
  const clientId = checkpoint('commit', 'p-commit');
  clientId.checkpointId = 'client-selected';
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: clientId }), (error) => error instanceof ApiError && error.code === 'CHECKPOINT_ID_SERVER_ASSIGNED');
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

test('block.insert creates deterministic unique IDs from a stable anchor and rejects raw markup', async () => {
  const operation = { type: 'block.insert', block: { type: 'callout', tone: 'question', text: 'What assumption changes the result?' }, position: { afterBlockId: 'b-work' } };
  const first = await applySemanticOperation(baseChapter(), operation);
  const second = await applySemanticOperation(baseChapter(), operation);
  assert.equal(first.chapter.body[2].blockId, second.chapter.body[2].blockId);
  assert.match(first.chapter.body[2].passageId, /^passage_/);
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'block.insert', block: { type: 'legacyMarkup', html: '<script>x</script>' }, position: { afterBlockId: 'b-work' } }), (error) => error instanceof ApiError && error.code === 'BLOCK_TYPE_FORBIDDEN');
  await assert.rejects(applySemanticOperation(baseChapter(), { type: 'block.insert', block: { type: 'paragraph', text: '<style>body{display:none}</style>' }, position: { afterBlockId: 'b-work' } }), (error) => error instanceof ApiError && error.code === 'RAW_MARKUP_FORBIDDEN');
});

test('checkpoint.remove targets the immutable slot and optional stable ID', async () => {
  const added = await applySemanticOperation(baseChapter(), { type: 'checkpoint.upsert', checkpoint: checkpoint('commit', 'p-commit') });
  const id = added.chapter.checkpoints[0].checkpointId;
  await assert.rejects(applySemanticOperation(added.chapter, { type: 'checkpoint.remove', slot: 'commit', checkpointId: 'wrong' }), (error) => error instanceof ApiError && error.code === 'CHECKPOINT_ID_CONFLICT');
  const removed = await applySemanticOperation(added.chapter, { type: 'checkpoint.remove', slot: 'commit', checkpointId: id });
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
  assert.deepEqual(OPERATION_PAYLOAD_SCHEMAS['checkpoint.remove'], { required: ['type', 'slot'], optional: ['checkpointId'] });
  assert.deepEqual(OPERATION_PAYLOAD_SCHEMAS['media.place'], { required: ['type', 'placement'], optional: ['position'] });
});

test('Worker serves the versioned operation envelope to authenticated readers without database access', async () => {
  const headers = { 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_agent_1', 'x-content-actor-type': 'agent', 'x-content-client-id': 'mcp', 'x-content-run-id': 'run-1', 'x-content-scopes': 'content:read' };
  const response = await worker.fetch(new Request('https://content.example/v1/schema', { headers }), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schemaVersion, 1);
  assert.deepEqual(body.mutationEnvelope.required, ['baseRevisionId', 'expectedVersion', 'idempotencyKey', 'operation']);
  assert.deepEqual(body.operations['embed.upsert'].required, ['type', 'embed']);
  assert.equal(body.media.requestUpload.route, 'POST /v1/media:requestUpload');
  assert.equal(body.media.requestUpload.policy.totalStorageLimitBytes, 8 * 1024 * 1024 * 1024);
  assert.equal(body.media.requestUpload.transcriptEquivalent.timedCaptionTrackClaimed, false);
  assert.equal(body.media.reviewPackage.decide.humanActorRequired, true);
  assert.equal(body.media.search.query.limit, '1-50');
  assert.equal(body.providers.resolve.networkAccess, false);
  assert.equal(body.reads.dependencies.route, 'GET /v1/chapters/{chapterId}/dependencies');
  assert.equal(body.release.asset.requiresExactReleaseApproval, true);
  assert.equal(body.rateLimits.persistence, 'D1 fail-closed');
  assert.equal(body.canaryAuthority.route, 'POST /v1/authority/chapter_ch07:activateD1');
  assert.equal(body.review.diff.route, 'POST /v1/changesets/{changesetId}:diff');
  assert.equal(body.review.reject.scope, 'content:approve');
  assert.equal(body.review.approve.humanActorRequired, true);
  assert.equal(body.review.restoreAsDraft.route, 'POST /v1/chapters/{chapterId}/revisions/{revisionId}:restoreAsDraft');
  assert.equal(body.release.snapshot.scope, 'content:releaseSnapshot');
  assert.equal(body.release.metadata.route, 'GET /v1/releases/{releaseId}');
  assert.equal(body.release.publish.humanActorRequired, true);
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
  const headers = { 'content-type': 'application/json', 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_agent_1', 'x-content-actor-type': 'agent', 'x-content-client-id': 'mcp', 'x-content-run-id': 'run-1', 'x-content-scopes': 'media:upload' };
  const response = await worker.fetch(new Request('https://content.example/v1/media:requestUpload', { method: 'POST', headers, body: '{}' }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'MEDIA_BINDING_UNAVAILABLE');
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

  const readHeaders = { 'x-content-gateway-verified': 'v1', 'x-content-actor-id': 'actor_agent_1', 'x-content-actor-type': 'agent', 'x-content-client-id': 'mcp', 'x-content-run-id': 'run-1', 'x-content-scopes': 'content:write' };
  response = await worker.fetch(new Request('https://content.example/v1/chapters', { headers: readHeaders }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN');

  const mutationHeaders = { ...readHeaders, 'content-type': 'application/json', 'content-length': '200000' };
  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/changesets', { method: 'POST', headers: mutationHeaders, body: JSON.stringify({ actorId: 'forged' }) }), {});
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'BODY_TOO_LARGE');

  delete mutationHeaders['content-length'];
  response = await worker.fetch(new Request('https://content.example/v1/chapters/chapter-07/changesets', { method: 'POST', headers: mutationHeaders, body: JSON.stringify({ actorId: 'forged' }) }), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'UNKNOWN_FIELD');
});

test('Wrangler binding declaration separates each private R2 concern and both queue DLQs', async () => {
  const config = await readFile(new URL('../../workers/content-api/wrangler.jsonc', import.meta.url), 'utf8');
  for (const binding of ['CONTENT_MEDIA', 'UPLOAD_QUARANTINE', 'CONTENT_SNAPSHOTS', 'RELEASE_ARTIFACTS', 'CONTENT_BACKUPS', 'MEDIA_JOB_ENVELOPES', 'MEDIA_JOBS', 'RELEASE_JOBS']) assert.match(config, new RegExp(`\\"${binding}\\"`));
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
