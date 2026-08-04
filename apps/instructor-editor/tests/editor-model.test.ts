import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_CHAPTER } from "../src/demo-chapter";
import { addCheckpoint, addPersonFeature, blockPassage, chapterReplaceOperation, cloneChapter, moveCheckpoint, nearestPassage } from "../src/editor-model";
import { serializeBody } from "../src/tiptap-editor";

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
  moveCheckpoint(chapter, moved.checkpointId, otherAnchor, 0);
  assert.equal(moved.passageId, otherAnchor);
  assert.equal(moved.displayOrder, 0);
  assert.deepEqual(chapter.checkpoints.filter((item) => item.passageId === firstAnchor).map((item) => item.displayOrder).sort(), [0]);
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
