import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import worker, { createMcp } from '../../workers/textbook-mcp/src/index.mjs';

const env = { MCP_ACCESS_TOKEN: 'test-token', CONTENT_API: { fetch: async () => new Response(JSON.stringify({ chapters: [] }), { headers: { 'content-type': 'application/json' } }) } };

test('protocol initializes, lists tools, and calls a read tool', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcp(env, 'run_test');
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport); await client.connect(clientTransport);
  const tools = await client.listTools();
  assert.equal(tools.tools.some(tool => tool.name === 'approve_changeset' || tool.name === 'publish_changeset'), false);
  assert.ok(tools.tools.some(tool => tool.name === 'replace_text'));
  const response = await client.callTool({ name: 'list_chapters', arguments: {} });
  assert.equal(response.isError, undefined);
  assert.match(response.content[0].text, /chapters/);
  await client.close(); await server.close();
});

test('worker rejects callers without the MCP bearer secret', async () => {
  const response = await worker.fetch(new Request('https://mcp.example/mcp'), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('www-authenticate'), 'Bearer');
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
