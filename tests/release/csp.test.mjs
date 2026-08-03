import assert from "node:assert/strict";
import test from "node:test";
import { extractMetaCsp } from "../../scripts/release/csp.mjs";

test("extracts a double-quoted CSP containing single-quoted source values", () => {
  const html = `<html><head><meta http-equiv="content-security-policy" content="default-src 'self';object-src 'none'"></head></html>`;
  assert.equal(extractMetaCsp(html), "default-src 'self';object-src 'none'");
});

test("accepts case-insensitive names and arbitrary attribute order", () => {
  const html = `<META data-test="csp" CONTENT="default-src 'self';object-src 'none'" HTTP-EQUIV="Content-Security-Policy">`;
  assert.equal(extractMetaCsp(html), "default-src 'self';object-src 'none'");
});

test("ignores unrelated meta elements", () => {
  const html = `<meta name="description" content="content-security-policy"><meta charset="utf-8">`;
  assert.equal(extractMetaCsp(html), "");
});
