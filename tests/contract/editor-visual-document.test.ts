import assert from "node:assert/strict";
import test from "node:test";
import { reconcileDuplicateStableBlockIds } from "../../src/lib/editor-visual-document";

test("contenteditable splits keep the stable ID on the canonical fragment", () => {
  const original = { type: "paragraph", blockId: "block-opening", text: "The original opening paragraph remains here." };
  const result = reconcileDuplicateStableBlockIds([
    { type: "paragraph", blockId: "block-opening", text: "Test" },
    { type: "paragraph", blockId: "block-opening", text: "The original opening paragraph remains here." }
  ], [original]);
  assert.deepEqual(result, [
    { type: "paragraph", text: "Test" },
    original
  ]);
});

test("duplicate managed previews are discarded rather than converted to new raw blocks", () => {
  const managed = { type: "legacyMarkup", blockId: "block-legacy", preserve: true };
  assert.deepEqual(reconcileDuplicateStableBlockIds([managed, { ...managed }], [managed]), [managed]);
});
