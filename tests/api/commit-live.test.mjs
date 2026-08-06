import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { classifyUnhandledError } from '../../workers/content-api/src/index.mjs';
import { sha256 } from '../../workers/content-api/src/services.mjs';

const gatewayHeaders = (scopes = 'content:read content:write') => ({
  'content-type': 'application/json',
  'x-content-gateway-verified': 'v1',
  'x-content-actor-id': 'actor_editor_1',
  'x-content-actor-type': 'human',
  'x-content-client-id': 'editor',
  'x-content-run-id': 'run-editor-1',
  'x-content-scopes': scopes
});

const chapter = () => ({
  schemaVersion: 2,
  chapterId: 'chapter_ch07', slug: 'aristotle-character-and-ai-assisted-life', title: 'Aristotle', description: 'A chapter about character.',
  chapterVersion: 'revision-base', revisionId: 'revision-base', status: 'published', body: [
    { type: 'paragraph', blockId: 'block_one', passageId: 'passage_one', text: 'Initial prose.' }
  ], checkpoints: []
});

const fakeDb = (resolve) => ({
  statements: [], batches: [],
  prepare(sql) {
    const statement = {
      sql, args: [], bind(...args) { this.args = args; return this; },
      first: async () => resolve(sql, statement.args, 'first'),
      all: async () => resolve(sql, statement.args, 'all') || { results: [] },
      run: async () => ({ meta: { changes: 1 } })
    };
    this.statements.push(statement); return statement;
  },
  async batch(items) { this.batches.push(items); return items.map(() => ({ meta: { changes: 1 }, results: [{ request_count: 1 }] })); }
});

test('unexpected API diagnostics classify failures without retaining request-derived values', () => {
  const filename = 'student-private-upload-name.webp';
  const error = new Error(`R2 put failed for media/uploads/${filename}`);
  const diagnostic = JSON.stringify({ kind: classifyUnhandledError(error) });
  assert.equal(diagnostic, '{"kind":"r2"}');
  assert.doesNotMatch(diagnostic, /student|upload-name|media\//);
});

test('commitLive writes its guarded receipt first, then one revision and one public projection, and verifies delivery', async () => {
  const source = chapter(); const sourceHash = await sha256(source);
  const working = { id: 'working_1', document_id: source.chapterId, base_revision_id: 'revision-base', content_hash: sourceHash, content_text: JSON.stringify(source), version: 2, state: 'open', purpose: 'authoring', current_revision_id: 'revision-base', current_content_hash: sourceHash };
  const db = fakeDb((sql) => {
    if (sql.includes('FROM live_commit_commands')) return null;
    if (sql.includes('INSERT INTO api_rate_limits')) return { results: [{ request_count: 1 }] };
    if (sql.includes('SELECT w.*, c.state')) return { results: [working] };
    if (sql.includes('SELECT id, authority, source_revision')) return { id: 'authority_1', authority: 'd1', source_revision: 'revision-base', normalized_snapshot_hash: sourceHash };
    return null;
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { headers: { 'x-textbook-revision': 'revision_ignored', 'x-textbook-projection-hash': 'projection_ignored' } });
  try {
    // The first delivery check intentionally fails because the generated IDs are
    // unknown to the test transport; D1 still reports a recoverable 202.
    const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs_1:commitLive', {
      method: 'POST', headers: gatewayHeaders(), body: JSON.stringify({
        documentId: source.chapterId, baseRevisionId: 'revision-base', expectedVersion: 2,
        idempotencyKey: 'commit-live-key-123', operations: [{ type: 'text.replace', blockId: 'block_one', text: 'Committed prose.' }]
      })
    }), { CONTENT_DB: db, PUBLIC_READER_ORIGIN: 'https://reader.example' });
    assert.equal(response.status, 202, await response.text());
    const batch = db.batches.find((items) => items.some((statement) => statement.sql.includes('INSERT INTO live_commit_commands')));
    assert.ok(batch);
    assert.match(batch[0].sql, /INSERT INTO live_commit_commands/);
    assert.match(batch[0].sql, /'committing'/);
    assert.ok(batch.some((statement) => statement.sql.includes('INSERT INTO document_revisions')));
    assert.ok(batch.some((statement) => statement.sql.includes('UPDATE authority_registry SET source_revision')));
    assert.ok(batch.some((statement) => statement.sql.includes('INSERT INTO public_chapter_projections')));
    assert.ok(batch.some((statement) => statement.sql.includes('INSERT INTO public_chapter_heads')));
    assert.ok(batch.some((statement) => statement.sql.includes('INSERT INTO live_commit_delivery_status')));
    assert.ok(batch.some((statement) => statement.sql.includes("state = 'applied'")));
  } finally { globalThis.fetch = originalFetch; }
});

test('commitLive publishes an already-edited working draft even when the final replacement is identical to that draft', async () => {
  const canonical = chapter(); const canonicalHash = await sha256(canonical);
  const draft = structuredClone(canonical); draft.body[0].text = 'Drafted before the final commit call.';
  const working = { id: 'working_draft', document_id: canonical.chapterId, base_revision_id: 'revision-base', content_hash: await sha256(draft), content_text: JSON.stringify(draft), version: 3, state: 'open', purpose: 'authoring', current_revision_id: 'revision-base', current_content_hash: canonicalHash };
  const db = fakeDb((sql) => {
    if (sql.includes('FROM live_commit_commands')) return null;
    if (sql.includes('INSERT INTO api_rate_limits')) return { results: [{ request_count: 1 }] };
    if (sql.includes('SELECT w.*, c.state')) return { results: [working] };
    if (sql.includes('SELECT id, authority, source_revision')) return { id: 'authority_1', authority: 'd1', source_revision: 'revision-base', normalized_snapshot_hash: canonicalHash };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs_draft:commitLive', {
    method: 'POST', headers: gatewayHeaders(), body: JSON.stringify({ documentId: canonical.chapterId, baseRevisionId: 'revision-base', expectedVersion: 3, idempotencyKey: 'commit-existing-draft-1', operations: [{ type: 'chapter.replaceDocument', document: draft }] })
  }), { CONTENT_DB: db, PUBLIC_READER_ORIGIN: 'https://reader.example' });
  assert.equal(response.status, 202, await response.text());
  const batch = db.batches.find((items) => items.some((statement) => statement.sql.includes('INSERT INTO live_commit_commands')));
  assert.ok(batch?.some((statement) => statement.sql.includes('INSERT INTO document_revisions')));
  assert.equal(batch?.some((statement) => statement.sql.includes("state = 'unchanged'")), false);
});

test('commitLive binds normalized media projection fields into the public asset allowlist', async () => {
  const source = chapter();
  source.body.push({
    type: 'mediaFigure', figureId: 'figure_one', blockId: 'block_media', anchorPassageId: 'passage_one',
    mediaId: 'media_one', mediaVersionId: 'media_version_one', rightsCaseId: 'rights_one', decorative: false,
    alt: 'An illuminated manuscript.', caption: 'A manuscript.', teachingUse: 'Shows textual transmission.',
    displayPreset: 'reading', align: 'center', printPolicy: 'poster', downloadable: false
  });
  const sourceHash = await sha256(source);
  const working = { id: 'working_media', document_id: source.chapterId, base_revision_id: 'revision-base', content_hash: sourceHash, content_text: JSON.stringify(source), version: 2, state: 'open', purpose: 'authoring', current_revision_id: 'revision-base', current_content_hash: sourceHash };
  const derivativeHash = 'd'.repeat(64);
  const derivativeKey = 'media/job/sha256/source/display.webp';
  const db = fakeDb((sql) => {
    if (sql.includes('FROM live_commit_commands')) return null;
    if (sql.includes('INSERT INTO api_rate_limits')) return { results: [{ request_count: 1 }] };
    if (sql.includes('SELECT w.*, c.state')) return { results: [working] };
    if (sql.includes('SELECT id, authority, source_revision')) return { id: 'authority_1', authority: 'd1', source_revision: 'revision-base', normalized_snapshot_hash: sourceHash };
    if (sql.includes('FROM media_assets a JOIN media_asset_versions')) return {
      media_id: 'media_one', title: 'Manuscript', media_state: 'ready', media_version_id: 'media_version_one',
      source_sha256: 'a'.repeat(64), source_bytes: 100, detected_mime: 'image/webp', immutable_address: `sha256:${'a'.repeat(64)}`,
      technical_json: '{"width":720,"height":879,"animated":false,"poster":null}', rights_case_id: 'rights_one', review_id: 'review_one',
      rights_status: 'cleared', review_package_id: 'review_package_one', rights_json: '{"attribution":"Creator. CC BY-SA 4.0."}',
      declaration_hash: 'b'.repeat(64), review_package_state: 'cleared'
    };
    if (sql.includes('FROM media_version_objects')) return { results: [{ id: 'object_one', role: 'derivative', object_key: derivativeKey, object_sha256: derivativeHash, object_bytes: 91, content_type: 'image/webp' }] };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/changesets/cs_media:commitLive', {
    method: 'POST', headers: gatewayHeaders(), body: JSON.stringify({
      documentId: source.chapterId, baseRevisionId: 'revision-base', expectedVersion: 2,
      idempotencyKey: 'commit-media-key-123', operations: [{ type: 'text.replace', blockId: 'block_one', text: 'Committed prose.' }]
    })
  }), { CONTENT_DB: db, PUBLIC_READER_ORIGIN: 'https://reader.example' });
  assert.equal(response.status, 202, await response.text());
  const batch = db.batches.find((items) => items.some((statement) => statement.sql.includes('INSERT INTO live_commit_commands')));
  const asset = batch?.find((statement) => statement.sql.includes('INSERT INTO public_media_assets'));
  assert.deepEqual(asset?.args.slice(0, 4), [derivativeHash, derivativeKey, 91, 'image/webp']);
});

test('authoring view is revision-bound and status polling promotes only a pending receipt', async () => {
  const source = chapter(); const sourceHash = await sha256(source);
  const command = { id: 'commit_1', changeset_id: 'cs_1', document_id: source.chapterId, result_revision_id: 'revision_2', result_content_hash: 'b'.repeat(64), projection_id: 'projection_1', projection_hash: 'a'.repeat(64), public_url: 'https://reader.example/chapter/aristotle-character-and-ai-assisted-life/', state: 'committed', delivery_state: 'confirmation_pending', actor_id: 'actor_editor_1', client_id: 'editor', created_at: '2026-08-03T00:00:00Z', committed_at: '2026-08-03T00:00:00Z', status_expires_at: '2099-08-04T00:00:00Z' };
  const db = fakeDb((sql) => {
    if (sql.includes('FROM documents d JOIN document_revisions')) return { id: source.chapterId, canonical_path: 'content/chapters/07-aristotle/', title: source.title, state: 'active', current_revision_id: 'revision-base', current_content_hash: sourceHash, content_text: JSON.stringify(source), metadata_json: '{}', revision_created_at: '2026-08-03T00:00:00Z' };
    if (sql.includes('FROM authority_registry')) return { id: 'authority_1', authority: 'd1', source_revision: 'revision-base', normalized_snapshot_hash: sourceHash };
    if (sql.includes('FROM live_commit_commands')) return command;
    return null;
  });
  const view = await worker.fetch(new Request(`https://content.example/v1/chapters/${source.chapterId}/authoring-view`, { headers: gatewayHeaders() }), { CONTENT_DB: db });
  assert.equal(view.status, 200); const body = await view.json();
  assert.equal(body.revisionId, 'revision-base'); assert.equal(body.renderer.rendererVersion, 'chapter-renderer-v3-layouts');
  let bindingDocumentId = null;
  const status = await worker.fetch(new Request('https://content.example/v1/live-commits/commit_1', { headers: gatewayHeaders() }), {
    CONTENT_DB: db,
    PUBLIC_READER_DELIVERY: { getDeliveryIdentity: async (documentId) => {
      bindingDocumentId = documentId;
      return { documentId, publicPath: new URL(command.public_url).pathname, revisionId: 'revision_2', projectionHash: 'a'.repeat(64) };
    } }
  });
  assert.equal(status.status, 200); assert.equal((await status.json()).deliveryStatus, 'verified');
  assert.equal(bindingDocumentId, source.chapterId);
  assert.ok(db.statements.some((statement) => statement.sql.includes('UPDATE live_commit_delivery_status')));
});

test('delivery verification uses the reader Worker RPC identity and rejects a mismatched public route', async () => {
  const command = { id: 'commit_public_probe', changeset_id: 'cs_probe', document_id: 'chapter_ch07', result_revision_id: 'revision_public', result_content_hash: 'b'.repeat(64), projection_id: 'projection_public', projection_hash: 'c'.repeat(64), public_url: 'https://reader.example/chapter/aristotle-character-and-ai-assisted-life/', state: 'committed', delivery_state: 'confirmation_pending', actor_id: 'actor_editor_1', client_id: 'editor', created_at: '2026-08-03T00:00:00Z', committed_at: '2026-08-03T00:00:00Z', status_expires_at: '2099-08-04T00:00:00Z' };
  const db = fakeDb((sql) => sql.includes('FROM live_commit_commands') ? command : null);
  let rpcCalls = 0;
  const response = await worker.fetch(new Request('https://content.example/v1/live-commits/commit_public_probe', { headers: gatewayHeaders() }), {
    CONTENT_DB: db,
    PUBLIC_READER_DELIVERY: { getDeliveryIdentity: async (documentId) => {
      rpcCalls += 1;
      assert.equal(documentId, command.document_id);
      return { documentId, publicPath: new URL(command.public_url).pathname, revisionId: command.result_revision_id, projectionHash: command.projection_hash };
    } },
  });
  const responseText = await response.text();
  assert.equal(response.status, 200, responseText);
  assert.equal(JSON.parse(responseText).deliveryStatus, 'verified');
  assert.equal(rpcCalls, 1);

  command.id = 'commit_wrong_route';
  const wrongRoute = await worker.fetch(new Request('https://content.example/v1/live-commits/commit_wrong_route', { headers: gatewayHeaders() }), {
    CONTENT_DB: db,
    PUBLIC_READER_DELIVERY: { getDeliveryIdentity: async (documentId) => ({ documentId, publicPath: '/chapter/not-the-command-route/', revisionId: command.result_revision_id, projectionHash: command.projection_hash }) },
  });
  assert.equal(wrongRoute.status, 202);
  assert.equal((await wrongRoute.json()).deliveryStatus, 'confirmation_pending');
});

test('delivery verification retains the HTTP reader probe as a local fallback', async () => {
  const command = { id: 'commit_http_fallback', changeset_id: 'cs_fallback', document_id: 'chapter_ch07', result_revision_id: 'revision_http', result_content_hash: 'b'.repeat(64), projection_id: 'projection_http', projection_hash: 'd'.repeat(64), public_url: 'https://reader.example/chapter/aristotle-character-and-ai-assisted-life/', state: 'committed', delivery_state: 'confirmation_pending', actor_id: 'actor_editor_1', client_id: 'editor', created_at: '2026-08-03T00:00:00Z', committed_at: '2026-08-03T00:00:00Z', status_expires_at: '2099-08-04T00:00:00Z' };
  const db = fakeDb((sql) => sql.includes('FROM live_commit_commands') ? command : null);
  const response = await worker.fetch(new Request('https://content.example/v1/live-commits/commit_http_fallback', { headers: gatewayHeaders() }), {
    CONTENT_DB: db,
    PUBLIC_READER: { fetch: async (request) => {
      assert.equal(request.url, command.public_url);
      assert.equal(request.headers.get('x-textbook-delivery-probe'), 'v1');
      return new Response(null, { status: 204, headers: { 'x-content-revision': command.result_revision_id, 'x-content-projection-hash': command.projection_hash } });
    } },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deliveryStatus, 'verified');
});
