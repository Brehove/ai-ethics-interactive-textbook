import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import worker, { createMcp, signAgentCapability, verifyAgentCapability } from '../../workers/textbook-mcp/src/index.mjs';

const capabilitySecret = 'test-capability-secret-at-least-32-bytes-long';
const claims = (scopes = ['content:read', 'content:write', 'content:submit', 'media:read', 'media:upload']) => { const now = Math.floor(Date.now() / 1000); return { iss: 'ai-ethics-editor', aud: 'ai-ethics-textbook-mcp', sub: 'actor_agent_test', actorType: 'agent', clientId: 'codex-test', runId: 'run_agent_test', scopes, iat: now - 1, exp: now + 600, jti: 'test-jti' }; };
const env = { MCP_CAPABILITY_SECRET: capabilitySecret, CONTENT_API: { fetch: async () => new Response(JSON.stringify({ chapters: [] }), { headers: { 'content-type': 'application/json' } }) } };

test('protocol initializes, lists tools, and calls a read tool', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcp(env, 'run_test');
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport); await client.connect(clientTransport);
  const tools = await client.listTools();
  assert.equal(tools.tools.some(tool => tool.name === 'approve_changeset' || tool.name === 'publish_changeset'), false);
  assert.equal(tools.tools.some(tool => tool.name === 'upload_media_base64' || tool.name === 'request_media_upload'), false);
  assert.ok(tools.tools.some(tool => tool.name === 'replace_text'));
  assert.ok(tools.tools.some(tool => tool.name === 'create_changeset'));
  assert.equal(tools.tools.every(tool => typeof tool.annotations?.idempotentHint === 'boolean'), true);
  const response = await client.callTool({ name: 'list_chapters', arguments: {} });
  assert.equal(response.isError, undefined);
  assert.match(response.content[0].text, /chapters/);
  await client.close(); await server.close();
});

test('MCP exposes document-targeted multi-chapter creation, mutation, diff, preview, and atomic submission', async () => {
  const calls = [];
  const routeEnv = { CONTENT_API: { fetch: async (request) => {
    calls.push({ pathname: new URL(request.url).pathname, body: request.method === 'GET' ? null : await request.clone().json().catch(() => null) });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } } };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcp(routeEnv, 'run_multi'); const client = new Client({ name: 'multi-client', version: '1.0.0' });
  await server.connect(serverTransport); await client.connect(clientTransport);
  const key = '019fc57c-899f-7c32-b1bb-4ca8fc34b886';
  await client.callTool({ name: 'create_changeset', arguments: { title: 'Two chapter repair', targets: ['chapter_ch07', 'chapter_ch08'], idempotencyKey: key } });
  await client.callTool({ name: 'replace_text', arguments: { changeSetId: 'cs_multi', documentId: 'chapter_ch08', baseRevisionId: 'revision_b', expectedVersion: 2, idempotencyKey: key, operation: { type: 'text.replace', blockId: 'block_1', text: 'Revised.' } } });
  await client.callTool({ name: 'diff_changeset', arguments: { changeSetId: 'cs_multi', documentId: 'chapter_ch08' } });
  await client.callTool({ name: 'render_preview', arguments: { changeSetId: 'cs_multi', documentId: 'chapter_ch08', baseRevisionId: 'revision_b', expectedVersion: 3, idempotencyKey: key } });
  await client.callTool({ name: 'submit_changeset', arguments: { changeSetId: 'cs_multi', documents: [{ documentId: 'chapter_ch07', baseRevisionId: 'revision_a', expectedVersion: 1 }, { documentId: 'chapter_ch08', baseRevisionId: 'revision_b', expectedVersion: 3 }], idempotencyKey: key } });
  assert.equal(calls[0].pathname, '/v1/changesets'); assert.deepEqual(calls[0].body.targets, ['chapter_ch07', 'chapter_ch08']);
  assert.equal(calls[1].pathname, '/v1/changesets/cs_multi:apply'); assert.equal(calls[1].body.documentId, 'chapter_ch08');
  assert.equal(calls[2].pathname, '/v1/changesets/cs_multi:diff'); assert.deepEqual(calls[2].body, { documentId: 'chapter_ch08' });
  assert.equal(calls[3].body.documentId, 'chapter_ch08'); assert.equal(calls[4].body.documents.length, 2); assert.equal(calls[4].body.baseRevisionId, undefined);
  await client.close(); await server.close();
});

test('raw authenticated media lane keeps binary data and upload tokens outside MCP tool context', async () => {
  const calls = [];
  const uploadEnv = { MCP_CAPABILITY_SECRET: capabilitySecret, CONTENT_API: { fetch: async (request) => {
    const body = request.method === 'PUT' ? new Uint8Array(await request.arrayBuffer()) : await request.json();
    calls.push({ pathname: new URL(request.url).pathname, method: request.method, headers: request.headers, body });
    return new Response(JSON.stringify(request.method === 'PUT'
      ? { ticketId: 'upload_12345678', jobId: 'mediajob_12345678', state: 'queued', sha256: 'a'.repeat(64) }
      : { ticketId: 'upload_12345678', jobId: 'mediajob_12345678', upload: { token: 'one-time-token-123456', requiredHeaders: {} } }), { status: request.method === 'PUT' ? 202 : 201, headers: { 'content-type': 'application/json' } });
  } } };
  const authorization = `Bearer ${await signAgentCapability(claims(), capabilitySecret)}`;
  const metadata = { reviewPackageId: 'reviewpkg_12345678', filename: 'clip.webm', mimeType: 'video/webm', bytes: 4, sha256: 'a'.repeat(64), idempotencyKey: '019fc57c-899f-7c32-b1bb-4ca8fc34b886', transcriptEquivalent: { provided: true, language: 'en', text: 'Equivalent.' }, poster: { provided: true, alt: 'Poster.' } };
  let response = await worker.fetch(new Request('https://mcp.example/media-upload/request', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify(metadata) }), uploadEnv);
  assert.equal(response.status, 201);
  response = await worker.fetch(new Request('https://mcp.example/media-upload/upload_12345678', { method: 'PUT', headers: { authorization, 'content-type': 'video/webm', 'content-length': '4', 'x-content-sha256': 'a'.repeat(64), 'x-upload-token': 'one-time-token-123456' }, body: new Uint8Array([1, 2, 3, 4]) }), uploadEnv);
  assert.equal(response.status, 202);
  assert.equal(calls[0].pathname, '/v1/media:requestUpload');
  assert.equal(calls[1].pathname, '/v1/media/uploads/upload_12345678');
  assert.deepEqual([...calls[1].body], [1, 2, 3, 4]);
  assert.equal(calls[1].headers.get('x-content-actor-type'), 'agent');
  const helper = await readFile(new URL('../../.agents/skills/publish-textbook-media/scripts/upload-media.mjs', import.meta.url), 'utf8');
  assert.match(helper, /readFile\(filePath\)/);
  assert.doesNotMatch(helper, /contentBase64|base64/i);
});

test('worker rejects callers without the MCP bearer secret', async () => {
  const response = await worker.fetch(new Request('https://mcp.example/mcp'), env);
  assert.equal(response.status, 401);
  assert.match(response.headers.get('www-authenticate'), /invalid_token/);
});

test('signed per-agent capabilities preserve identity, expire quickly, and hide out-of-scope tools', async () => {
  const readClaims = claims(['content:read']); const token = await signAgentCapability(readClaims, capabilitySecret);
  assert.deepEqual((await verifyAgentCapability(token, capabilitySecret)).scopes, ['content:read']);
  await assert.rejects(() => verifyAgentCapability(token, 'wrong-secret-but-still-at-least-32-characters'));
  const overlongToken = await signAgentCapability({ ...readClaims, exp: readClaims.iat + 7200 }, capabilitySecret);
  await assert.rejects(() => verifyAgentCapability(overlongToken, capabilitySecret));
  const identity = await verifyAgentCapability(token, capabilitySecret);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcp(env, identity.runId, identity); const client = new Client({ name: 'scoped-client', version: '1.0.0' });
  await server.connect(serverTransport); await client.connect(clientTransport);
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  assert.ok(tools.includes('get_chapter')); assert.ok(tools.includes('list_revisions')); assert.equal(tools.includes('replace_text'), false); assert.equal(tools.includes('submit_changeset'), false); assert.equal(tools.includes('create_media_review_package'), false);
  const resources = await client.listResources(); assert.deepEqual(resources.resources.map((item) => item.uri).sort(), ['textbook://capabilities', 'textbook://chapters', 'textbook://schema']);
  const receipt = await client.readResource({ uri: 'textbook://capabilities' }); assert.match(receipt.contents[0].text, /actor_agent_test/); assert.match(receipt.contents[0].text, /cannot/);
  await client.close(); await server.close();
});

test('media, provider, diff, paginated passage, and evidence tools call the frozen Content API routes with current payloads', async () => {
  const calls = [];
  const routeEnv = {
    CONTENT_API: { fetch: async (request) => {
      calls.push({ url: new URL(request.url), method: request.method, body: request.method === 'GET' ? null : await request.clone().json().catch(() => null) });
      const pathname = new URL(request.url).pathname;
      const data = pathname.endsWith('/dependencies')
        ? { revisionId: 'revision_1', nodes: [{ id: 'passage_1' }, { id: 'checkpoint_1' }], edges: [{ source: 'checkpoint_1', target: 'passage_1', kind: 'anchoredTo' }], page: { nextCursor: null } }
        : { ok: true, state: 'pending', id: 'reviewpkg_1234567890abcdef12345678' };
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    } }
  };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcp(routeEnv, 'run_routes');
  const client = new Client({ name: 'route-test-client', version: '1.0.0' });
  await server.connect(serverTransport); await client.connect(clientTransport);

  const review = await client.callTool({ name: 'create_media_review_package', arguments: {
    rights: { basis: 'owned', creator: 'Instructor', attribution: 'Instructor, original work' },
    editorial: { teachingUse: 'Illustrates a course concept.', placementIntent: 'After passage one.' },
    accessibility: { decorative: false, altText: 'A compact explanatory diagram.' },
    idempotencyKey: '019fc57c-899f-7c32-b1bb-4ca8fc34b886'
  } });
  assert.equal(review.isError, undefined);
  await client.callTool({ name: 'search_media', arguments: { query: 'diagram', rightsStatus: 'cleared', limit: 10 } });
  await client.callTool({ name: 'resolve_provider_url', arguments: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expectedProvider: 'youtube' } });
  await client.callTool({ name: 'diff_changeset', arguments: { changeSetId: 'cs_1' } });
  await client.callTool({ name: 'list_passages', arguments: { chapterId: 'chapter_ch07', limit: 25, cursor: 50 } });
  await client.callTool({ name: 'get_passage', arguments: { chapterId: 'chapter_ch07', passageId: 'passage_1' } });
  await client.callTool({ name: 'get_passage_dependencies', arguments: { chapterId: 'chapter_ch07', passageId: 'passage_1', limit: 10, cursor: 20 } });
  await client.callTool({ name: 'get_changeset', arguments: { changeSetId: 'cs_1' } });
  await client.callTool({ name: 'get_release', arguments: { releaseId: 'release_1' } });
  await client.callTool({ name: 'render_preview', arguments: { changeSetId: 'cs_1', baseRevisionId: 'revision_1', expectedVersion: 2, idempotencyKey: '019fc57c-899f-7c32-b1bb-4ca8fc34b886', surface: 'print' } });

  assert.equal(calls[0].url.pathname, '/v1/media-review-packages');
  assert.equal(calls[0].body.rights.basis, 'owned');
  assert.equal(calls[1].url.pathname, '/v1/media');
  assert.equal(calls[1].url.searchParams.get('rightsStatus'), 'cleared');
  assert.equal(calls[2].url.pathname, '/v1/embeds:resolve');
  assert.equal(calls[3].url.pathname, '/v1/changesets/cs_1:diff');
  assert.equal(calls[4].url.pathname, '/v1/chapters/chapter_ch07/passages');
  assert.equal(calls[4].url.searchParams.get('limit'), '25');
  assert.equal(calls[4].url.searchParams.get('cursor'), '50');
  assert.equal(calls[5].url.pathname, '/v1/chapters/chapter_ch07/passages/passage_1');
  assert.equal(calls[6].url.pathname, '/v1/chapters/chapter_ch07/dependencies');
  assert.equal(calls[6].url.searchParams.get('passageId'), 'passage_1');
  assert.equal(calls[6].url.searchParams.get('limit'), '10');
  assert.equal(calls[6].url.searchParams.get('cursor'), '20');
  assert.equal(calls[7].url.pathname, '/v1/changesets/cs_1');
  assert.equal(calls[8].url.pathname, '/v1/releases/release_1');
  assert.equal(calls[9].url.pathname, '/v1/changesets/cs_1:renderPreview');
  assert.equal(calls[9].body.surface, 'print');
  assert.equal(calls.every((entry) => entry.method === 'GET' || entry.url.pathname === '/v1/media-review-packages' || entry.url.pathname === '/v1/embeds:resolve' || entry.url.pathname.endsWith(':diff') || entry.url.pathname.endsWith(':renderPreview')), true);
  await client.close(); await server.close();
});
