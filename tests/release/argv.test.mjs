import assert from "node:assert/strict";
import test from "node:test";
import { optionValue } from "../../scripts/release/argv.mjs";

test("returns an option value only when the named option is present", () => {
  const args = ["--base-url", "https://preview.example", "--asset-digests", "assets.sha256"];
  assert.equal(optionValue(args, "--base-url"), "https://preview.example");
  assert.equal(optionValue(args, "--asset-digests"), "assets.sha256");
  assert.equal(optionValue(args, "--out"), undefined);
});

test("returns undefined for a present option without a value", () => {
  assert.equal(optionValue(["--base-url"], "--base-url"), undefined);
});
