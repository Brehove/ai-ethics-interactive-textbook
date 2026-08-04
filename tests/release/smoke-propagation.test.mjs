import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);

test('production asset smoke tolerates bounded Cloudflare propagation without weakening digests', async () => {
  const source = await readFile(new URL('../../scripts/release/smoke.mjs', import.meta.url), 'utf8');
  assert.match(source, /ASSET_PROPAGATION_ATTEMPTS = 45/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /createHash\("sha256"\).*=== expected/);
  assert.match(source, /Asset digest gate failed after propagation retries/);
});

test('release smoke derives every dynamic chapter route from the signed complete candidate', async () => {
  const source = await readFile(new URL('../../scripts/release/smoke.mjs', import.meta.url), 'utf8');
  assert.match(source, /chapters\.length !== 18/);
  assert.match(source, /new Set\(slugs\)\.size !== 18/);
  assert.match(source, /requiredRoutes\.push\(\.\.\.slugs\.map/);
  assert.match(source, /`\/chapter\/\$\{slug\}\/`/);
});

test('release smoke fetches the home page and all 18 candidate chapter routes', async (context) => {
  const requested = [];
  const server = http.createServer((request, response) => {
    requested.push(request.url);
    response.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'; object-src 'none'" });
    response.end('<main><h1>Release route</h1></main>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'release-smoke-test-'));
  const candidate = path.join(temporary, 'candidate.json');
  const slugs = Array.from({ length: 18 }, (_, index) => `chapter-${String(index + 1).padStart(2, '0')}`);
  await writeFile(candidate, JSON.stringify({ releaseSnapshot: { chapters: slugs.map((slug) => ({ slug })) } }));
  const address = server.address();
  await exec(process.execPath, ['scripts/release/smoke.mjs', '--base-url', `http://127.0.0.1:${address.port}`, '--candidate', candidate]);
  assert.deepEqual(requested, ['/', ...slugs.map((slug) => `/chapter/${slug}/`)]);
});
