import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public reader preserves OAuth popup callbacks without dropping its security headers", async () => {
  const headers = await readFile(new URL("../../public/_headers", import.meta.url), "utf8");

  assert.match(headers, /^\s*Cross-Origin-Opener-Policy: same-origin-allow-popups\s*$/m);
  assert.doesNotMatch(headers, /^\s*Cross-Origin-Opener-Policy: same-origin\s*$/m);
  assert.match(headers, /^\s*Cross-Origin-Resource-Policy: same-origin\s*$/m);
  assert.match(headers, /^\s*Content-Security-Policy: frame-ancestors 'none'\s*$/m);
  assert.match(headers, /^\s*X-Frame-Options: DENY\s*$/m);
});
