import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_CHAPTER } from "../src/demo-chapter";
import { addCheckpoint, addPersonFeature, blockPassage, chapterReplaceOperation, checkpointAnchorBlock, checkpointExcerpt, cloneChapter, moveCheckpoint, nearestPassage } from "../src/editor-model";
import { editorDocumentContent, managedNodeSequence, serializeBody } from "../src/tiptap-editor";

test("new checkpoints require a real passage anchor and do not create prose blocks", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const proseCount = chapter.body.length;
  const checkpoint = addCheckpoint(chapter, { title: "Work", prompt: "Test a judgment.", guidance: "Use the passage.", stage: "Work", strategy: "reflection", showInSidebar: true }, "not-a-passage");
  assert.equal(checkpoint.passageId, nearestPassage(chapter));
  assert.equal(chapter.body.length, proseCount);
  assert.equal(chapter.checkpoints.at(-1)?.checkpointId, checkpoint.checkpointId);
});

test("checkpoints can be reordered at one anchor and moved to another passage", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const firstAnchor = chapter.checkpoints[0].passageId;
  const sameAnchor = chapter.checkpoints.filter((item) => item.passageId === firstAnchor);
  if (sameAnchor.length < 2) {
    const original = sameAnchor[0];
    chapter.checkpoints.push({ ...structuredClone(original), checkpointId: "checkpoint_reorder_test", displayOrder: 1, title: "Second" });
  }
  const ordered = chapter.checkpoints.filter((item) => item.passageId === firstAnchor).sort((a, b) => a.displayOrder - b.displayOrder);
  const moved = moveCheckpoint(chapter, ordered.at(-1)!.checkpointId, firstAnchor, 0);
  assert.equal(moved.displayOrder, 0);
  assert.deepEqual(chapter.checkpoints.filter((item) => item.passageId === firstAnchor).map((item) => item.displayOrder).sort(), [0, 1]);
  const otherAnchor = chapter.body.map((block) => blockPassage(block)).find((passageId) => passageId && passageId !== firstAnchor)!;
  assert.throws(() => moveCheckpoint(chapter, moved.checkpointId, otherAnchor, 0), /excerpt hash/);
  moveCheckpoint(chapter, moved.checkpointId, otherAnchor, 0, "b".repeat(64));
  assert.equal(moved.passageId, otherAnchor);
  assert.equal(moved.displayOrder, 0);
  assert.equal(moved.passageExcerptHash, "b".repeat(64));
  assert.deepEqual(chapter.checkpoints.filter((item) => item.passageId === firstAnchor).map((item) => item.displayOrder).sort(), [0]);
});

test("an unchanged checkpoint position remains stable when persisted orders are sparse", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const first = chapter.checkpoints[0];
  chapter.checkpoints = [
    { ...structuredClone(first), checkpointId: "checkpoint_sparse_first", displayOrder: 4, title: "First" },
    { ...structuredClone(first), checkpointId: "checkpoint_sparse_second", displayOrder: 5, title: "Second" }
  ];
  moveCheckpoint(chapter, "checkpoint_sparse_first", first.passageId, 0);
  const ordered = chapter.checkpoints
    .filter((checkpoint) => checkpoint.passageId === first.passageId)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  assert.deepEqual(ordered.map((checkpoint) => checkpoint.checkpointId), ["checkpoint_sparse_first", "checkpoint_sparse_second"]);
  assert.deepEqual(ordered.map((checkpoint) => checkpoint.displayOrder), [4, 5]);
});

test("checkpoint reorder preserves managed placement position and title-only order", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const first = chapter.checkpoints[0];
  chapter.checkpoints = [
    { ...structuredClone(first), checkpointId: "checkpoint_managed_first", displayOrder: 4 },
    { ...structuredClone(first), checkpointId: "checkpoint_managed_second", displayOrder: 5 },
  ];
  chapter.managedPlacements = [{ placementId: "placement_between", kind: "personFeature", contentId: "personfeature_aristotle", anchorPassageId: first.passageId, position: "after", orderAtAnchor: 2, displayPreset: "thinker-card" }];
  moveCheckpoint(chapter, "checkpoint_managed_first", first.passageId, 0);
  assert.deepEqual(chapter.checkpoints.map((item) => item.displayOrder), [4, 5]);
  assert.equal(chapter.managedPlacements[0].orderAtAnchor, 2);
  moveCheckpoint(chapter, "checkpoint_managed_second", first.passageId, 0);
  const sequence = [
    ...chapter.checkpoints.map((item) => ({ id: item.checkpointId, order: item.displayOrder })),
    { id: chapter.managedPlacements[0].placementId, order: chapter.managedPlacements[0].orderAtAnchor },
  ].sort((a, b) => a.order - b.order).map((item) => item.id);
  assert.deepEqual(sequence, ["placement_between", "checkpoint_managed_second", "checkpoint_managed_first"]);
  assert.deepEqual(managedNodeSequence(chapter, first.passageId).map((node) => node.kind === "checkpoint" ? node.item.checkpointId : node.item.placementId), sequence);
});

test("checkpoint excerpts cover code and table anchors and prefer passage owners", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  chapter.body = [
    { type: "mediaFigure", blockId: "media_before", anchorPassageId: "passage_table", caption: "Context" },
    { type: "table", blockId: "table_owner", passageId: "passage_table", columns: ["Claim", "Reason"], rows: [["A", "B"]] },
    { type: "codeBlock", blockId: "code_owner", passageId: "passage_code", code: "const judgment = true;" },
  ] as never;
  assert.equal(checkpointAnchorBlock(chapter, "passage_table")?.blockId, "table_owner");
  assert.equal(checkpointExcerpt(checkpointAnchorBlock(chapter, "passage_table")), "Claim\nReason\nA\nB");
  assert.equal(checkpointExcerpt(checkpointAnchorBlock(chapter, "passage_code")), "const judgment = true;");
  assert.equal(checkpointExcerpt({ type: "list", blockId: "list", passageId: "passage_list", text: "stale", items: ["Visible A", "Visible B"] }), "Visible A\nVisible B");
});

test("editor renders checkpoints after table and standalone locked anchor owners", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const template = chapter.checkpoints[0];
  chapter.body = [
    { type: "table", blockId: "table_owner", passageId: "passage_table", columns: ["Claim"], rows: [["Reason"]] },
    { type: "legacyMarkup", blockId: "legacy_owner", anchorPassageId: "passage_legacy", locked: true, sanitizedHtml: "<aside>Worked example</aside>", importedFrom: "chapter.md" },
  ] as never;
  chapter.checkpoints = [
    { ...structuredClone(template), checkpointId: "checkpoint_table", passageId: "passage_table", displayOrder: 0 },
    { ...structuredClone(template), checkpointId: "checkpoint_legacy", passageId: "passage_legacy", displayOrder: 0 },
  ];
  const content = editorDocumentContent(chapter);
  assert.deepEqual(content.map((node) => String((node.attrs as Record<string, unknown>).placementId)), [
    "table_owner", "checkpoint_table", "legacy_owner", "checkpoint_legacy",
  ]);
});

test("person features remain independent managed placements, never editable prose", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const proseCount = chapter.body.length;
  const originalPlacementId = chapter.personFeatures[0].placementId;
  const { feature, placement } = addPersonFeature(chapter, "personfeature_aristotle", "passage_habituation");
  assert.equal(placement.kind, "personFeature");
  assert.equal(placement.anchorPassageId, "passage_habituation");
  assert.equal(chapter.personFeatures[0].placementId, originalPlacementId);
  assert.notEqual(feature.placementId, originalPlacementId);
  assert.equal(feature.placementId, placement.placementId);
  assert.equal(feature.personFeatureId, placement.contentId);
  assert.equal(chapter.body.length, proseCount);
});

test("Save emits one atomic chapter.replaceDocument operation", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  chapter.body.push({ type: "mediaFigure", blockId: "media_block_1", figureId: "figure_1", mediaId: "media_1", mediaVersionId: "version_1", rightsCaseId: "rights_1", decorative: false, alt: "A test image", caption: "Test", teachingUse: "Test", displayPreset: "reading", align: "center", printPolicy: "poster", downloadable: false, src: "https://auth.example/transient-preview", editorPreviewUrl: "https://auth.example/transient-preview", previewPath: "/v1/media/transient", derivativeUrl: "/media/published", posterUrl: "/media/poster", credit: "Projected credit" });
  const operation = chapterReplaceOperation(chapter);
  assert.equal(operation.type, "chapter.replaceDocument");
  assert.ok("personFeatures" in (operation.document as object));
  const savedMedia = (operation.document as { body: Array<Record<string, unknown>> }).body.find((block) => block.type === "mediaFigure");
  if (savedMedia) {
    assert.equal("src" in savedMedia, false);
    assert.equal("editorPreviewUrl" in savedMedia, false);
    assert.equal("previewPath" in savedMedia, false);
  }
});

test("continuous serialization preserves text nested inside a blockquote paragraph", () => {
  const previous = [{ type: "blockquote", blockId: "quote_1", passageId: "passage_quote_1", text: "Original quotation." }] as const;
  const body = serializeBody({ type: "doc", content: [{
    type: "blockquote", attrs: { blockId: "quote_1", passageId: "passage_quote_1" },
    content: [{ type: "paragraph", content: [{ type: "text", text: "Revised quotation." }] }]
  }] }, structuredClone(previous) as never);
  assert.deepEqual(body, [{ type: "blockquote", blockId: "quote_1", passageId: "passage_quote_1", text: "Revised quotation." }]);
});
