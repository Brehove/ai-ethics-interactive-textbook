import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../workers/content-api/src/index.mjs';
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
  assert.equal(body.revisionId, 'revision-base'); assert.equal(body.renderer.rendererVersion, 'chapter-renderer-v1');
  let bindingCalled = false;
  const status = await worker.fetch(new Request('https://content.example/v1/live-commits/commit_1', { headers: gatewayHeaders() }), {
    CONTENT_DB: db,
    PUBLIC_READER: { fetch: async (request) => { bindingCalled = request.url === command.public_url; return new Response('', { headers: { 'x-textbook-revision': 'revision_2', 'x-textbook-projection-hash': 'a'.repeat(64) } }); } }
  });
  assert.equal(status.status, 200); assert.equal((await status.json()).deliveryStatus, 'verified');
  assert.equal(bindingCalled, true);
  assert.ok(db.statements.some((statement) => statement.sql.includes('UPDATE live_commit_delivery_status')));
});
