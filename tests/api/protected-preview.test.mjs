import assert from 'node:assert/strict';
import test from 'node:test';
import contentWorker from '../../workers/content-api/src/index.mjs';
import previewWorker from '../../workers/textbook-preview/src/index.mjs';
import { sha256, stableStringify } from '../../workers/content-api/src/services.mjs';

const headers = { 'content-type': 'application/json', authorization: 'Bearer preview-test' };
const capability = { verifyCapability: async () => ({ actorId: 'actor_preview_test', actorType: 'agent', clientId: 'mcp', runId: 'run-preview', scopes: ['content:read', 'content:write'], allowedDocumentIds: ['chapter_ch07'], allowedOperations: ['render_preview'] }) };
const chapter = { schemaVersion: 1, chapterId: 'chapter_ch07', title: 'Preview chapter', body: [{ type: 'heading', blockId: 'b1', passageId: 'p1', text: 'A heading', level: 2 }, { type: 'paragraph', blockId: 'b2', passageId: 'p2', text: 'Safe preview prose.' }], checkpoints: [] };

const dbForIssue = () => ({
  batches: [],
  prepare(sql) { const statement = { sql, args: [], bind(...args) { this.args = args; return this; }, async first() {
    if (sql.includes('FROM idempotency_records')) return null;
    return null;
  }, async all() { return sql.includes('FROM working_documents w') ? { results: [{ document_id: 'chapter_ch07', base_revision_id: 'revision-base', content_hash: 'a'.repeat(64), content_text: stableStringify(chapter), version: 2, state: 'open', current_revision_id: 'revision-base' }] } : { results: [] }; } }; return statement; },
  async batch(items) { this.batches.push(items); return items.map((item) => item.sql.includes('INSERT INTO api_rate_limits') ? { results: [{ request_count: 1 }], meta: { changes: 1 } } : { meta: { changes: 1 } }); }
});

test('Content API issues an immutable five-minute one-time preview without requiring publishable checkpoint completeness', async () => {
  const CONTENT_DB = dbForIssue(); const objects = new Map();
  const CONTENT_SNAPSHOTS = { async head(key) { return objects.has(key) ? {} : null; }, async put(key, value) { objects.set(key, value); } };
  const response = await contentWorker.fetch(new Request('https://content.example/v1/changesets/cs_preview:renderPreview', { method: 'POST', headers, body: JSON.stringify({ baseRevisionId: 'revision-base', expectedVersion: 2, idempotencyKey: '019fc57c-899f-7c32-b1bb-4ca8fc34b886', surface: 'mobile' }) }), { CONTENT_DB, CONTENT_SNAPSHOTS, AUTH_CAPABILITY: capability, PREVIEW_TOKEN_SECRET: 'preview-secret-at-least-thirty-two-bytes', PREVIEW_ORIGIN: 'https://preview.example' });
  assert.equal(response.status, 201); const body = await response.json();
  assert.equal(body.oneTime, true); assert.equal(body.surface, 'mobile'); assert.match(body.previewUrl, /^https:\/\/preview\.example\/preview\?token=v1\./); assert.equal(Date.parse(body.expiresAt) > Date.now(), true);
  assert.equal(objects.has(`previews/${body.snapshotHash}.json`), true);
  assert.equal(CONTENT_DB.batches.at(-1).some((item) => item.sql.includes('INSERT INTO preview_grants')), true);
});

test('Preview Worker verifies, renders every checkpoint at a shared passage, escapes, and refuses token replay', async () => {
  const secret = 'preview-secret-at-least-thirty-two-bytes'; const snapshot = { schemaVersion: 1, kind: 'draftPreview', changesetId: 'cs_preview', documentId: 'chapter_ch07', baseRevisionId: 'revision-base', workingVersion: 2, contentHash: 'a'.repeat(64), surface: 'web', chapter: { ...chapter, body: [...chapter.body, { type: 'paragraph', blockId: 'b3', text: '<script>never executable</script>' }], checkpoints: [{ checkpointId: 'checkpoint_1', passageId: 'p2', slot: 'first', title: 'First pause', prompt: 'First prompt', minWords: 20, maxWords: 100, showInSidebar: true }, { checkpointId: 'checkpoint_2', passageId: 'p2', slot: 'second', title: 'Second pause', prompt: 'Second prompt', minWords: 20, maxWords: 100, showInSidebar: true }] } };
  const raw = stableStringify(snapshot); const snapshotHash = await sha256(raw); const grantId = `preview_${'b'.repeat(24)}`; const exp = Math.floor(Date.now() / 1000) + 300;
  const payload = btoa(JSON.stringify({ v: 1, jti: grantId, sh: snapshotHash, exp })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))].map((byte) => byte.toString(16).padStart(2, '0')).join(''); const token = `v1.${payload}.${signature}`; const tokenHash = await sha256(token); let consumed = false;
  const CONTENT_DB = { prepare(sql) { return { bind(...args) { return { async first() { return sql.startsWith('SELECT') && args[0] === tokenHash ? { id: grantId, snapshot_hash: snapshotHash, r2_object_key: `previews/${snapshotHash}.json`, surface: 'web', expires_at: new Date(exp * 1000).toISOString(), consumed_at: consumed ? new Date().toISOString() : null } : null; }, async run() { if (consumed) return { meta: { changes: 0 } }; consumed = true; return { meta: { changes: 1 } }; } }; } }; } };
  const env = { CONTENT_DB, CONTENT_SNAPSHOTS: { get: async () => ({ text: async () => raw }) }, PREVIEW_TOKEN_SECRET: secret };
  let response = await previewWorker.fetch(new Request(`https://preview.example/preview?token=${encodeURIComponent(token)}`), env); assert.equal(response.status, 200); const html = await response.text();
  assert.match(html, /Protected draft preview/); assert.match(html, /First pause/); assert.match(html, /Second pause/); assert.match(html, /&lt;script&gt;never executable&lt;\/script&gt;/); assert.doesNotMatch(html, /<script>never executable<\/script>/); assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive'); assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  response = await previewWorker.fetch(new Request(`https://preview.example/preview?token=${encodeURIComponent(token)}`), env); assert.equal(response.status, 410);
});
