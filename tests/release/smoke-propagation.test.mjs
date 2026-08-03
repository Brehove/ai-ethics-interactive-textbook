import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production asset smoke tolerates bounded Cloudflare propagation without weakening digests', async () => {
  const source = await readFile(new URL('../../scripts/release/smoke.mjs', import.meta.url), 'utf8');
  assert.match(source, /ASSET_PROPAGATION_ATTEMPTS = 10/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /createHash\("sha256"\).*=== expected/);
  assert.match(source, /Asset digest gate failed after propagation retries/);
});
