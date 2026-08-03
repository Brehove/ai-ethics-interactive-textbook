import assert from "node:assert/strict";
import test from "node:test";
import {
  discardEmptyEditableVisualBlocks,
  normalizeVisualDocumentBlocks,
  reconcileDuplicateStableBlockIds,
} from "../../src/lib/editor-visual-document";

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

test("empty editable blocks are discarded even when Chromium copied a stable ID", () => {
  assert.deepEqual(discardEmptyEditableVisualBlocks([
    { type: "paragraph", blockId: "block-opening", text: "\u200b" },
    { type: "heading", text: "   " },
    { type: "paragraph", blockId: "block-next", text: "Keep this passage." },
    { type: "legacyMarkup", blockId: "block-legacy", preserve: true },
  ]), [
    { type: "paragraph", blockId: "block-next", text: "Keep this passage." },
    { type: "legacyMarkup", blockId: "block-legacy", preserve: true },
  ]);
});

test("normalization reconciles a split before dropping its blank stable fragment", () => {
  const original = { type: "paragraph", blockId: "block-opening", text: "The original opening paragraph remains here." };
  assert.deepEqual(normalizeVisualDocumentBlocks([
    { type: "paragraph", blockId: "block-opening", text: "" },
    { type: "paragraph", blockId: "block-opening", text: "The original opening paragraph remains here." },
  ], [original]), [original]);
});

test("clearing a stable paragraph serializes as a deletion instead of invalid empty text", () => {
  const original = { type: "paragraph", blockId: "block-remove", text: "Remove this paragraph." };
  assert.deepEqual(normalizeVisualDocumentBlocks([
    { type: "paragraph", blockId: "block-remove", text: "" },
    { type: "paragraph", blockId: "block-keep", text: "Keep this paragraph." },
  ], [original]), [
    { type: "paragraph", blockId: "block-keep", text: "Keep this paragraph." },
  ]);
});
