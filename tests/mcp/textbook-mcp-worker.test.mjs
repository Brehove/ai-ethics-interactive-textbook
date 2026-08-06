import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import worker, { createMcp, verifyCapability } from '../../workers/textbook-mcp/src/index.mjs';

const key = '019fc57c-899f-7c32-b1bb-4ca8fc34b886';
const editOperations = ['get_authoring_view', 'get_passage', 'get_layout_catalog', 'get_card_layout', 'get_valid_layout_options', 'validate_layout_proposal', 'create_or_resume_changeset', 'replace_passage_text', 'replace_chapter_document', 'upsert_checkpoint', 'remove_checkpoint', 'reorder_checkpoint', 'place_media', 'upsert_embed', 'resolve_provider_url', 'upsert_person_feature', 'move_managed_placement', 'remove_managed_placement', 'set_card_layout', 'reset_card_layout', 'set_card_frame', 'clear_card_frame', 'create_card_wrap', 'create_card_group', 'create_card_text_split', 'update_layout_region', 'remove_layout_region', 'reconcile_layout_region', 'search_media', 'create_media_review_package', 'upload_media', 'get_media_job', 'get_media_asset', 'preview_changes', 'get_live_commit_status', 'get_version_history', 'restore_revision_as_draft', 'search_persons', 'get_person', 'request_live_save_authorization'];
const claims = (overrides = {}) => ({ actorId: 'actor_agent_test', actorType: 'agent', clientId: 'codex-test', runId: 'run_agent_test', jti: 'grant_test_123', scopes: ['content:read', 'content:write', 'media:read', 'media:upload'], allowedDocumentIds: ['chapter_ch07'], allowedOperations: editOperations, expiresAt: '2026-08-03T20:00:00.000Z', ...overrides });
function makeEnv({ verified = claims(), api = async () => ({ ok: true }), requestLiveSave = async (_token, target) => ({ requestId: 'capreq_live_7', verificationUrl: 'https://auth.example/approve', userCode: 'ABC12345', target }), consumeLiveSave = async () => ({ pending: true }) } = {}) {
  return {
    AUTH_CAPABILITY: {
      verifyCapability: async (token, target) => { assert.ok(['device-flow-test', 'live-save-test'].includes(token)); assert.equal(typeof target, 'object'); return typeof verified === 'function' ? verified(token, target) : verified; },
      requestLiveSaveAuthorization: requestLiveSave,
      consumeLiveSaveAuthorization: consumeLiveSave,
    },
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
  for (const name of ['get_authoring_view', 'get_layout_catalog', 'get_card_layout', 'get_valid_layout_options', 'validate_layout_proposal', 'create_or_resume_changeset', 'replace_chapter_document', 'upsert_checkpoint', 'remove_checkpoint', 'reorder_checkpoint', 'place_media', 'upsert_embed', 'resolve_provider_url', 'upsert_person_feature', 'move_managed_placement', 'remove_managed_placement', 'set_card_layout', 'reset_card_layout', 'set_card_frame', 'clear_card_frame', 'create_card_wrap', 'create_card_group', 'create_card_text_split', 'update_layout_region', 'remove_layout_region', 'reconcile_layout_region', 'search_media', 'create_media_review_package', 'upload_media', 'get_media_job', 'get_media_asset', 'preview_changes', 'get_version_history', 'restore_revision_as_draft']) assert.ok(names.includes(name), name);
  for (const name of ['save_live_revision', 'create_changeset', 'replace_text', 'approve_changeset', 'publish_changeset']) assert.equal(names.includes(name), false, name);
  assert.equal(names.includes('request_live_save_authorization'), true);
  assert.equal(names.includes('commit_live'), true);
  await client.close(); await server.close();
});

test('media and provider tools expose the complete Skill workflow and exact API routes', async () => {
  const calls = [];
  const env = makeEnv({ api: async (request) => {
    calls.push({ path: `${new URL(request.url).pathname}${new URL(request.url).search}`, method: request.method, body: request.method === 'GET' ? null : await request.clone().json() });
    return { ok: true };
  } });
  const { client, server } = await connected(env);
  await client.callTool({ name: 'search_media', arguments: { query: 'Aristotle', kind: 'image', rightsStatus: 'cleared', limit: 10 } });
  await client.callTool({ name: 'create_media_review_package', arguments: { rights: { basis: 'publicDomain', creator: 'Unknown', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg', license: 'Public domain', attribution: 'Public domain image.' }, editorial: { teachingUse: 'Compare the portrait with the chapter account.', placementIntent: 'After the philosopher introduction.' }, accessibility: { decorative: false, altText: 'A portrait used to identify the philosopher.', motionReview: 'notApplicable' }, idempotencyKey: key } });
  await client.callTool({ name: 'get_media_job', arguments: { jobId: 'mediajob_7' } });
  await client.callTool({ name: 'get_media_asset', arguments: { mediaId: 'media_7' } });
  await client.callTool({ name: 'resolve_provider_url', arguments: { url: 'https://www.youtube.com/watch?v=abc123', expectedProvider: 'youtube' } });
  await client.callTool({ name: 'upsert_embed', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 1, idempotencyKey: key, operation: { type: 'embed.upsert', embed: { kind: 'externalEmbed', identity: { provider: 'youtube', resourceType: 'video', resourceId: 'abc123' }, canonicalUrl: 'https://www.youtube.com/watch?v=abc123', caption: 'A video argument.', teachingUse: 'Compare its premises.', presentation: { width: 'reading', align: 'center', density: 'standard' }, theme: 'auto', fallback: { title: 'Video argument', summary: 'A fallback summary.', linkLabel: 'Watch video', accessedAt: '2026-08-05T12:00:00.000Z' }, adapterVersion: 'youtube-v1' }, position: { afterNodeId: 'block_7' } } } });
  assert.equal(calls[0].path, '/v1/media?limit=10&cursor=0&q=Aristotle&kind=image&rightsStatus=cleared');
  assert.equal(calls[1].path, '/v1/media-review-packages'); assert.equal(calls[1].body.accessibility.decorative, false);
  assert.equal(calls[2].path, '/v1/media/jobs/mediajob_7');
  assert.equal(calls[3].path, '/v1/media/media_7');
  assert.equal(calls[4].path, '/v1/embeds:resolve'); assert.equal(calls[4].body.expectedProvider, 'youtube');
  assert.equal(calls[5].path, '/v1/changesets/changeset_7/operations:batch'); assert.equal(calls[5].body.operations[0].embed.identity.provider, 'youtube');
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
  await client.callTool({ name: 'replace_passage_text', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 1, idempotencyKey: key, operation: { type: 'text.replace', blockId: 'block_7', text: 'Revised passage.' } } });
  await client.callTool({ name: 'replace_chapter_document', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 2, idempotencyKey: key, operation: { type: 'chapter.replaceDocument', document: { blocks: [] } } } });
  await client.callTool({ name: 'reorder_checkpoint', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 3, idempotencyKey: key, operation: { type: 'checkpoint.move', checkpointId: 'checkpoint_7', position: { afterNodeId: 'block_7' } } } });
  const feature = { personFeatureId: 'personfeature_aquinas', placementId: 'placement_aquinas', personId: 'person_aquinas', entityRevisionId: 'personrev_7', name: 'Thomas Aquinas', dates: '1225–1274', role: 'Primary source', teachingNote: 'Compare natural-law reasoning.', biography: 'A medieval philosopher and theologian.', primarySources: [], portrait: { mediaVersionId: 'mediaversion_aquinas', src: '/media/aquinas.webp', width: 400, height: 500, alt: 'Portrait of Thomas Aquinas.', credit: 'Public domain.', title: 'Thomas Aquinas', license: 'Public domain' } };
  const placement = { placementId: 'placement_aquinas', kind: 'personFeature', contentId: 'personfeature_aquinas', anchorPassageId: 'passage_7', position: 'after', orderAtAnchor: 0, displayPreset: 'thinker-card' };
  await client.callTool({ name: 'upsert_person_feature', arguments: { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 4, idempotencyKey: key, operation: { type: 'personFeature.upsert', feature, placement } } });
  await client.callTool({ name: 'get_live_commit_status', arguments: { chapterId: 'chapter_ch07', commitReceiptId: 'commit_7' } });
  assert.equal(calls[0].path, '/v1/chapters/chapter_ch07/authoring-view');
  assert.equal(calls[1].path, '/v1/chapters/chapter_ch07/changesets');
  assert.equal(calls[1].body.documentIds, undefined);
  assert.equal(calls[2].path, '/v1/changesets/changeset_7/operations:batch');
  assert.deepEqual(calls[2].body.operations[0], { type: 'text.replace', blockId: 'block_7', text: 'Revised passage.' });
  assert.equal(calls[3].body.operations[0].type, 'chapter.replaceDocument');
  assert.deepEqual(calls[4].body.operations[0], { type: 'checkpoint.move', checkpointId: 'checkpoint_7', position: { afterNodeId: 'block_7' } });
  assert.equal(calls[5].body.operations[0].type, 'personFeature.upsert');
  assert.equal(calls[6].path, '/v1/live-commits/commit_7');
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

test('ordinary OAuth can request exact Live Save approval and cannot publish while it is pending', async () => {
  let requestedTarget;
  const env = makeEnv({ requestLiveSave: async (token, target) => { assert.equal(token, 'device-flow-test'); requestedTarget = target; return { requestId: 'capreq_live_7', verificationUrl: 'https://auth.example/approve', userCode: 'ABC12345', target }; } });
  const { client, server } = await connected(env);
  const target = { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 2, idempotencyKey: key };
  const requested = await client.callTool({ name: 'request_live_save_authorization', arguments: target });
  assert.equal(requested.structuredContent.requestId, 'capreq_live_7');
  assert.deepEqual(requestedTarget, target);
  const pending = await client.callTool({ name: 'commit_live', arguments: { liveSaveRequestId: 'capreq_live_7', ...target } });
  assert.equal(pending.structuredContent.state, 'authorization_pending');
  await client.close(); await server.close();
});

test('trusted OAuth publishes directly without a per-save approval request', async () => {
  let body;
  let consumed = false;
  const trustedIdentity = claims({ scopes: ['content:read', 'content:write', 'content:live-save'], allowedOperations: [...editOperations, 'commit_live'] });
  const env = makeEnv({
    verified: trustedIdentity,
    consumeLiveSave: async () => { consumed = true; throw new Error('per-save approval must not be used'); },
    api: async (request) => { body = await request.json(); assert.equal(request.headers.get('authorization'), 'Bearer device-flow-test'); return { deliveryStatus: 'verified' }; },
  });
  const { client, server } = await connected(env, trustedIdentity);
  const target = { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 2, idempotencyKey: key };
  const response = await client.callTool({ name: 'commit_live', arguments: target });
  assert.equal(response.isError, undefined);
  assert.deepEqual(body.operations, []);
  assert.equal(consumed, false);
  await client.close(); await server.close();
});

test('approved commit_live consumes the exact authorization and sends an explicit empty operation array', async () => {
  let body;
  const liveIdentity = claims({ scopes: ['content:read', 'content:write', 'content:live-save'], allowedOperations: [...editOperations, 'commit_live'] });
  let consumed;
  const env = makeEnv({
    verified: (token) => token === 'live-save-test' ? liveIdentity : claims(),
    consumeLiveSave: async (token, requestId, target) => { consumed = { token, requestId, target }; return { pending: false, accessToken: 'live-save-test' }; },
    api: async (request) => { body = await request.json(); assert.equal(request.headers.get('authorization'), 'Bearer live-save-test'); return { deliveryStatus: 'verified' }; },
  });
  const { client, server } = await connected(env);
  const target = { changeSetId: 'changeset_7', documentId: 'chapter_ch07', baseRevisionId: 'revision_7', expectedVersion: 2, idempotencyKey: key };
  const response = await client.callTool({ name: 'commit_live', arguments: { liveSaveRequestId: 'capreq_live_7', ...target } });
  assert.equal(response.isError, undefined); assert.deepEqual(body.operations, []);
  assert.deepEqual(consumed, { token: 'device-flow-test', requestId: 'capreq_live_7', target });
  await client.close(); await server.close();
});

test('hosted worker rejects missing or unverifiable bearer and does not expose an internal verifier route', async () => {
  const missing = await worker.fetch(new Request('https://mcp.example/mcp'), makeEnv()); assert.equal(missing.status, 401);
  assert.match(missing.headers.get('www-authenticate'), /oauth-protected-resource/);
  assert.match(missing.headers.get('www-authenticate'), /content:live-save/);
  const metadata = await worker.fetch(new Request('https://mcp.example/.well-known/oauth-protected-resource'), makeEnv());
  assert.equal(metadata.status, 200);
  const metadataBody = await metadata.json();
  assert.equal(metadataBody.resource, 'https://mcp.ethicsandai.your-digital-life.org/mcp');
  assert.deepEqual(metadataBody.authorization_servers, ['https://auth.ethicsandai.your-digital-life.org']);
  assert.equal(metadataBody.scopes_supported.includes('content:live-save'), true);
  const noVerifier = await worker.fetch(new Request('https://mcp.example/internal/verify', { headers: { authorization: 'Bearer device-flow-test' } }), { CONTENT_API: { fetch() {} } }); assert.equal(noVerifier.status, 401);
});

test('bounded media upload forwards exact bytes with only the one-time ticket token', async () => {
  const bytes = new TextEncoder().encode('gif-bytes');
  const digest = 'a'.repeat(64);
  const uploadToken = 'u'.repeat(64);
  let forwarded;
  const env = { CONTENT_API: { fetch: async (request) => {
    forwarded = request;
    return new Response(JSON.stringify({ ticketId: 'upload_7', jobId: 'mediajob_7', state: 'queued', sha256: digest }), { status: 202, headers: { 'content-type': 'application/json' } });
  } } };
  const response = await worker.fetch(new Request('https://mcp.ethicsandai.your-digital-life.org/media-upload/upload_7', {
    method: 'PUT',
    headers: { 'content-type': 'image/gif', 'content-length': String(bytes.byteLength), 'x-content-sha256': digest, 'x-upload-token': uploadToken },
    body: bytes,
  }), env);
  assert.equal(response.status, 202);
  assert.equal(forwarded.headers.get('authorization'), null);
  assert.equal(forwarded.headers.get('x-upload-token'), uploadToken);
  assert.equal(await forwarded.text(), 'gif-bytes');
});
