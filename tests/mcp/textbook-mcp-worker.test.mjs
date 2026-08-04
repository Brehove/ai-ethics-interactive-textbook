import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import worker, { createMcp, verifyCapability } from '../../workers/textbook-mcp/src/index.mjs';

const key = '019fc57c-899f-7c32-b1bb-4ca8fc34b886';
const editOperations = ['get_authoring_view', 'get_passage', 'create_or_resume_changeset', 'replace_passage_text', 'replace_chapter_document', 'upsert_checkpoint', 'remove_checkpoint', 'reorder_checkpoint', 'place_media', 'upsert_embed', 'upsert_person_feature', 'move_managed_placement', 'remove_managed_placement', 'upload_media', 'preview_changes', 'get_live_commit_status', 'get_version_history', 'restore_revision_as_draft', 'search_persons', 'get_person'];
const claims = (overrides = {}) => ({ actorId: 'actor_agent_test', actorType: 'agent', clientId: 'codex-test', runId: 'run_agent_test', jti: 'grant_test_123', scopes: ['content:read', 'content:write', 'media:upload'], allowedDocumentIds: ['chapter_ch07'], allowedOperations: editOperations, expiresAt: '2026-08-03T20:00:00.000Z', ...overrides });
function makeEnv({ verified = claims(), api = async () => ({ ok: true }) } = {}) {
  return {
    AUTH_CAPABILITY: { verifyCapability: async (token, target) => { assert.equal(token, 'device-flow-test'); assert.equal(typeof target, 'object'); return typeof verified === 'function' ? verified() : verified; } },
    CONTENT_API: { fetch: async (request) => new Response(JSON.stringify(await api(request)), { headers: { 'content-type': 'application/json' } }) }
  };
}
async function connected(env, identity = claims()) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcp(env, identity.runId, { identity, bearerToken: 'device-flow-test' });
  const client = new Client({ name: 'mcp-contract-test', version: '1.0.0' });
  await server.connect(serverTransport); await client.connect(clientTransport);
  return { client, server };
}

test('central private verifier is required and validates bounded claims', async () => {
  await assert.rejects(() => verifyCapability({}, 'device-flow-test'), /unavailable/);
  await assert.rejects(() => verifyCapability({ AUTH_CAPABILITY: { verifyCapability: async () => ({ actorType: 'agent' }) } }, 'device-flow-test'), /invalid/);
  const identity = await verifyCapability(makeEnv(), 'device-flow-test');
  assert.equal(identity.jti, 'grant_test_123');
  assert.deepEqual(identity.allowedDocumentIds, ['chapter_ch07']);
});

test('MCP exposes the Unified authoring contract rather than raw or legacy write tools', async () => {
  const env = makeEnv(); const { client, server } = await connected(env);
  const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
  for (const name of ['get_authoring_view', 'create_or_resume_changeset', 'replace_chapter_document', 'upsert_checkpoint', 'remove_checkpoint', 'reorder_checkpoint', 'place_media', 'upsert_embed', 'upsert_person_feature', 'move_managed_placement', 'remove_managed_placement', 'preview_changes', 'get_version_history', 'restore_revision_as_draft']) assert.ok(names.includes(name), name);
  for (const name of ['save_live_revision', 'create_changeset', 'replace_text', 'approve_changeset', 'publish_changeset']) assert.equal(names.includes(name), false, name);
  assert.equal(names.includes('commit_live'), false);
  await client.close(); await server.close();
});

test('tools use current Unified routes, batch semantic operations, and preserve the original bearer', async () => {
  const calls = [];
  const env = makeEnv({ api: async (request) => {
    calls.push({ path: new URL(request.url).pathname, method: request.method, body: request.method === 'GET' ? null : await request.clone().json(), authorization: request.headers.get('authorization'), actorHeader: request.headers.get('x-content-actor-id') });
    return { ok: true };
  } });
  const { client, server } = await connected(env);
  await client.callTool({ name: 'get_authoring_view', arguments: { chapterId: 'chapter_ch07' } });
  await client.callTool({ name: 'create_or_resume_changeset', arguments: { chapterId: 'chapter_ch07', title: 'Repair', resume: true, idempotencyKey: key } });
  await client.callTool({ name: 'replace_chapter_document', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 2, idempotencyKey: key, operation: { type: 'chapter.replaceDocument', document: { blocks: [] } } } });
  const reorderedCheckpoint = { checkpointId: 'checkpoint_7', passageId: 'passage_7', displayOrder: 9, strategy: 'self-explanation', title: 'Reordered pause', trigger: 'Pause.', prompt: 'Explain.', guidance: 'Use the chapter.', responseStructure: 'prose', minWords: 30, maxWords: 250, rationale: 'Reorder the prompt.', showInSidebar: true };
  await client.callTool({ name: 'reorder_checkpoint', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 3, idempotencyKey: key, operation: { type: 'checkpoint.upsert', checkpoint: reorderedCheckpoint } } });
  const feature = { personFeatureId: 'personfeature_aquinas', placementId: 'placement_aquinas', personId: 'person_aquinas', entityRevisionId: 'personrev_7', name: 'Thomas Aquinas', dates: '1225–1274', role: 'Primary source', teachingNote: 'Compare natural-law reasoning.', biography: 'A medieval philosopher and theologian.', primarySources: [], portrait: { mediaVersionId: 'mediaversion_aquinas', src: '/media/aquinas.webp', width: 400, height: 500, alt: 'Portrait of Thomas Aquinas.', credit: 'Public domain.', title: 'Thomas Aquinas', license: 'Public domain' } };
  const placement = { placementId: 'placement_aquinas', kind: 'personFeature', contentId: 'personfeature_aquinas', anchorPassageId: 'passage_7', position: 'after', orderAtAnchor: 0, displayPreset: 'thinker-card' };
  await client.callTool({ name: 'upsert_person_feature', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 4, idempotencyKey: key, operation: { type: 'personFeature.upsert', feature, placement } } });
  await client.callTool({ name: 'get_live_commit_status', arguments: { chapterId: 'chapter_ch07', commitReceiptId: 'commit_7' } });
  assert.equal(calls[0].path, '/v1/chapters/chapter_ch07/authoring-view');
  assert.equal(calls[1].path, '/v1/chapters/chapter_ch07/changesets');
  assert.equal(calls[1].body.documentIds, undefined);
  assert.equal(calls[2].path, '/v1/changesets/changeset_7/operations:batch');
  assert.equal(calls[2].body.operations[0].type, 'chapter.replaceDocument');
  assert.equal(calls[3].body.operations[0].checkpoint.displayOrder, 9);
  assert.equal(calls[4].body.operations[0].type, 'personFeature.upsert');
  assert.equal(calls[5].path, '/v1/live-commits/commit_7');
  assert.equal(calls.every((call) => call.authorization === 'Bearer device-flow-test'), true);
  assert.equal(calls.every((call) => call.actorHeader === null), true);
  await client.close(); await server.close();
});

test('checkpoint cardinality is arbitrary and repeated stages share an explicit display order', async () => {
  const calls = []; const env = makeEnv({ api: async (request) => { calls.push(await request.clone().json()); return { ok: true }; } });
  const { client, server } = await connected(env);
  const checkpoint = { passageId: 'passage_7', displayOrder: 12, stage: 'Reconsider', strategy: 'self-explanation', title: 'Another pause', trigger: 'Pause.', prompt: 'Explain.', guidance: 'Use the chapter.', responseStructure: 'prose', minWords: 30, maxWords: 250, rationale: 'A second prompt.', showInSidebar: true };
  const response = await client.callTool({ name: 'upsert_checkpoint', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 1, idempotencyKey: key, operation: { type: 'checkpoint.upsert', checkpoint } } });
  assert.equal(response.isError, undefined); assert.equal(calls[0].operations[0].checkpoint.displayOrder, 12);
  await client.close(); await server.close();
});

test('commit_live is hidden without the exact scope and operation, and re-verifies before mutation', async () => {
  const noLive = claims(); const { client: editClient, server: editServer } = await connected(makeEnv(), noLive);
  assert.equal((await editClient.listTools()).tools.some((tool) => tool.name === 'commit_live'), false);
  await editClient.close(); await editServer.close();
  let verificationCount = 0;
  const liveIdentity = claims({ scopes: ['content:read', 'content:write', 'content:live-save'], allowedOperations: [...editOperations, 'commit_live'] });
  const env = makeEnv({ verified: () => { verificationCount += 1; return verificationCount === 1 ? liveIdentity : claims(); } });
  const initialIdentity = await verifyCapability(env, 'device-flow-test');
  const { client, server } = await connected(env, initialIdentity);
  const response = await client.callTool({ name: 'commit_live', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 2, idempotencyKey: key } });
  assert.equal(response.isError, true); assert.match(response.content[0].text, /does not grant commit_live/);
  await client.close(); await server.close();
});

test('hosted worker rejects missing or unverifiable bearer and does not expose an internal verifier route', async () => {
  const missing = await worker.fetch(new Request('https://mcp.example/mcp'), makeEnv()); assert.equal(missing.status, 401);
  const noVerifier = await worker.fetch(new Request('https://mcp.example/internal/verify', { headers: { authorization: 'Bearer device-flow-test' } }), { CONTENT_API: { fetch() {} } }); assert.equal(noVerifier.status, 401);
});
