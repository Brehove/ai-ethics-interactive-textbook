import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEMO_CHAPTER } from "../src/demo-chapter";
import { addCheckpoint, addPersonFeature, assertUniqueEditorIdentities, blockPassage, chapterReplaceOperation, checkpointAnchorBlock, checkpointCreateOperation, checkpointExcerpt, cloneChapter, moveCheckpoint, nearestPassage, nextCheckpointOrder, normalizeEditorIdentities, personFeatureCreateOperation, removeCheckpoint, replaceProsePreservingManagedFlow, updateCheckpointDetails, upgradeEditorChapter } from "../src/editor-model";
import { editorDocumentContent, managedNodeSequence, serializeBody } from "../src/tiptap-editor";

const chapter4RecoveryFixture = JSON.parse(readFileSync(new URL("./fixtures/chapter-4-duplicate-ids.json", import.meta.url), "utf8"));

test("Chapter 4 recovery normalization preserves prose and the visible checkpoint boundary", () => {
  const result = normalizeEditorIdentities(chapter4RecoveryFixture.chapter, chapter4RecoveryFixture.original);
  assert.deepEqual(result.errors, []);
  assert.equal(result.repairs.length, 2);
  assert.equal(result.chapter.body[1].blockId, "block_paragraph_1_ch04-p0006");
  assert.equal(result.chapter.body[1].passageId, "passage_ch04-p0006");
  assert.notEqual(result.chapter.body[0].blockId, result.chapter.body[1].blockId);
  assert.notEqual(result.chapter.body[0].passageId, result.chapter.body[1].passageId);
  assert.equal(result.chapter.body[2].checkpointId, "checkpoint_opening-judgment");
  assert.deepEqual(result.chapter.body.filter((node: { type: string }) => node.type === "paragraph").map((node: { text: string }) => node.text), chapter4RecoveryFixture.expectedProse);
  assertUniqueEditorIdentities(result.chapter);
  const repeated = normalizeEditorIdentities(result.chapter, chapter4RecoveryFixture.original);
  assert.deepEqual(repeated.repairs, []);
});

test("noncontiguous duplicate stable IDs fail closed for repair review", () => {
  const invalid = structuredClone(chapter4RecoveryFixture.chapter);
  invalid.body.splice(1, 0, { type: "paragraph", blockId: "block_middle", passageId: "passage_middle", text: "Intervening prose." });
  const result = normalizeEditorIdentities(invalid, chapter4RecoveryFixture.original);
  assert.equal(result.errors.some((error) => error.code === "STABLE_ID_DUPLICATE_NONCONTIGUOUS"), true);
});

test("schema-v4 editor operations preserve one record and one ordered reference", () => {
  const chapter = upgradeEditorChapter({ ...cloneChapter(DEMO_CHAPTER), schemaVersion: 2 });
  assert.equal(chapter.schemaVersion, 4);
  const firstCheckpoint = chapter.checkpoints[0];
  assert.equal(chapter.body.filter((node) => node.type === "checkpointRef" && node.checkpointId === firstCheckpoint.checkpointId).length, 1);
  removeCheckpoint(chapter, firstCheckpoint.checkpointId);
  assert.equal(chapter.checkpoints.some((item) => item.checkpointId === firstCheckpoint.checkpointId), false);
  assert.equal(chapter.body.some((node) => node.type === "checkpointRef" && node.checkpointId === firstCheckpoint.checkpointId), false);
  const operation = chapterReplaceOperation(chapter);
  assert.equal(operation.type, "chapter.replaceDocumentV4");
});

test("schema-specific create operations separate legacy order from v3 flow position", () => {
  const v2 = cloneChapter(DEMO_CHAPTER);
  const checkpoint = { passageId: "passage_habituation", displayOrder: 2, title: "New" };
  assert.deepEqual(checkpointCreateOperation(v2, checkpoint, "block_habituation"), { type: "checkpoint.upsert", checkpoint });
  const feature = { personFeatureId: "personfeature_new", placementId: "placement_new" };
  const placement = { placementId: "placement_new", kind: "personFeature", contentId: "personfeature_new", anchorPassageId: "passage_habituation", position: "after", orderAtAnchor: 1, displayPreset: "thinker-card" };
  assert.deepEqual(personFeatureCreateOperation(v2, feature, placement, "block_habituation"), { type: "personFeature.upsert", feature, placement });

  const v4 = upgradeEditorChapter(v2);
  assert.deepEqual(checkpointCreateOperation(v4, checkpoint, "block_habituation"), { type: "checkpoint.upsert", checkpoint: { passageId: "passage_habituation", title: "New" }, position: { afterNodeId: "block_habituation" } });
  assert.deepEqual(personFeatureCreateOperation(v4, feature, placement, "block_habituation"), { type: "personFeature.upsert", feature, placement: { placementId: "placement_new", kind: "personFeature", contentId: "personfeature_new", anchorPassageId: "passage_habituation", presentation: { width: "reading", align: "center", density: "standard" } }, position: { afterNodeId: "block_habituation" } });
});

test("local whole-chapter replacement preserves ordered managed references", () => {
  const chapter = upgradeEditorChapter({ ...cloneChapter(DEMO_CHAPTER), schemaVersion: 2 });
  const managedReferences = chapter.body.filter((node) => node.type === "checkpointRef" || node.type === "placementRef");
  replaceProsePreservingManagedFlow(chapter, ["Replacement opening.", "Replacement conclusion."]);
  assert.deepEqual(chapter.body.filter((node) => node.type === "checkpointRef" || node.type === "placementRef"), managedReferences);
  assert.deepEqual(chapter.body.filter((node) => node.type === "paragraph").map((node) => node.text), ["Replacement opening.", "Replacement conclusion."]);
  assert.doesNotThrow(() => editorDocumentContent(chapter));
});

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

test("checkpoint reorder uses the combined checkpoint and placement order", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const first = chapter.checkpoints[0];
  chapter.checkpoints = [
    { ...structuredClone(first), checkpointId: "checkpoint_managed_first", displayOrder: 4 },
    { ...structuredClone(first), checkpointId: "checkpoint_managed_second", displayOrder: 5 },
  ];
  chapter.managedPlacements = [{ placementId: "placement_between", kind: "personFeature", contentId: "personfeature_aristotle", anchorPassageId: first.passageId, position: "after", orderAtAnchor: 2, displayPreset: "thinker-card" }];
  moveCheckpoint(chapter, "checkpoint_managed_first", first.passageId, 0);
  assert.deepEqual(managedNodeSequence(chapter, first.passageId).map((node) => node.kind === "checkpoint" ? node.item.checkpointId : node.item.placementId), ["checkpoint_managed_first", "placement_between", "checkpoint_managed_second"]);
  moveCheckpoint(chapter, "checkpoint_managed_second", first.passageId, 0);
  const sequence = [
    ...chapter.checkpoints.map((item) => ({ id: item.checkpointId, order: item.displayOrder })),
    { id: chapter.managedPlacements[0].placementId, order: chapter.managedPlacements[0].orderAtAnchor },
  ].sort((a, b) => a.order - b.order).map((item) => item.id);
  assert.deepEqual(sequence, ["checkpoint_managed_second", "checkpoint_managed_first", "placement_between"]);
  assert.deepEqual(managedNodeSequence(chapter, first.passageId).map((node) => node.kind === "checkpoint" ? node.item.checkpointId : node.item.placementId), sequence);
});

test("editor checkpoint ties use the same stable ID order as the reader", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const template = chapter.checkpoints[0];
  chapter.checkpoints = [
    { ...structuredClone(template), checkpointId: "checkpoint_z", displayOrder: 1 },
    { ...structuredClone(template), checkpointId: "checkpoint_a", displayOrder: 1 },
  ];
  chapter.managedPlacements = [{ placementId: "placement_tied", kind: "personFeature", contentId: "personfeature_aristotle", anchorPassageId: template.passageId, position: "after", orderAtAnchor: 1, displayPreset: "thinker-card" }];
  assert.deepEqual(managedNodeSequence(chapter, template.passageId).map((node) => node.kind === "checkpoint" ? node.item.checkpointId : node.item.placementId), ["checkpoint_a", "checkpoint_z", "placement_tied"]);
  const unchanged = moveCheckpoint(chapter, "checkpoint_a", template.passageId, 0);
  assert.equal(unchanged.displayOrder, 1);
});

test("first checkpoint can move before an existing placement at a new anchor", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const checkpoint = chapter.checkpoints[0];
  const targetAnchor = chapter.body.map(blockPassage).find((passageId) => passageId && passageId !== checkpoint.passageId)!;
  chapter.managedPlacements = [{ placementId: "placement_target", kind: "personFeature", contentId: "personfeature_aristotle", anchorPassageId: targetAnchor, position: "after", orderAtAnchor: 0, displayPreset: "thinker-card" }];
  moveCheckpoint(chapter, checkpoint.checkpointId, targetAnchor, 0, "b".repeat(64));
  assert.deepEqual(managedNodeSequence(chapter, targetAnchor).map((node) => node.kind === "checkpoint" ? node.item.checkpointId : node.item.placementId), [checkpoint.checkpointId, "placement_target"]);
  assert.equal(nextCheckpointOrder(chapter, targetAnchor), 2);
});

test("checkpoint details expose and validate the complete pedagogical control surface", () => {
  const checkpoint = structuredClone(DEMO_CHAPTER.checkpoints[0]);
  updateCheckpointDetails(checkpoint, { title: "Revised", prompt: "Explain the judgment.", guidance: "Use a reason.", trigger: "After the example", strategy: "counterexample", responseStructure: "movement-plus-prose", minWords: 20, maxWords: 80, showInSidebar: false, rationale: "Makes the objection visible.", stage: "Challenge" });
  assert.deepEqual({ title: checkpoint.title, trigger: checkpoint.trigger, strategy: checkpoint.strategy, responseStructure: checkpoint.responseStructure, minWords: checkpoint.minWords, maxWords: checkpoint.maxWords, showInSidebar: checkpoint.showInSidebar, rationale: checkpoint.rationale, stage: checkpoint.stage }, { title: "Revised", trigger: "After the example", strategy: "counterexample", responseStructure: "movement-plus-prose", minWords: 20, maxWords: 80, showInSidebar: false, rationale: "Makes the objection visible.", stage: "Challenge" });
  assert.throws(() => updateCheckpointDetails(checkpoint, { title: "Revised", prompt: "Explain.", guidance: "", trigger: "After", strategy: "counterexample", responseStructure: "prose", minWords: 90, maxWords: 20, showInSidebar: true, rationale: "Reason" }), /word guidance/);
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
  assert.equal(checkpointExcerpt({ type: "externalEmbed", blockId: "embed", anchorPassageId: "passage_embed", caption: "Outer caption", teachingUse: "Outer use", fallback: { title: "Fallback title", summary: "Fallback summary", linkLabel: "Open source" } }), "Fallback title\nFallback summary\nOpen source");
  assert.equal(checkpointExcerpt({ type: "mediaFigure", blockId: "media", anchorPassageId: "passage_media", alt: "Accessible portrait", caption: "Portrait caption", credit: "Projected credit", creditOverride: "Authored credit", teachingUse: "Invisible teaching note" }), "Accessible portrait\nPortrait caption\nAuthored credit");
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
    "table_owner", "checkpoint_table", "legacy_owner", "checkpoint_legacy", "placement_aristotle",
  ]);
});

test("editor retains checkpoints anchored only in the legacy passages collection", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const template = chapter.checkpoints[0];
  chapter.body = [{ type: "paragraph", blockId: "body_only", passageId: "passage_body", text: "Visible body passage." }];
  chapter.passages = [{ type: "paragraph", blockId: "legacy_only", passageId: "passage_legacy_only", text: "Legacy passage excerpt." }];
  chapter.checkpoints = [{ ...structuredClone(template), checkpointId: "checkpoint_legacy_only", passageId: "passage_legacy_only", displayOrder: 0 }];
  assert.equal(checkpointAnchorBlock(chapter, "passage_legacy_only")?.blockId, "legacy_only");
  assert.equal(nearestPassage(chapter, "passage_legacy_only"), "passage_legacy_only");
  const content = editorDocumentContent(chapter);
  assert.equal(content.some((node) => (node.attrs as Record<string, unknown> | undefined)?.placementId === "checkpoint_legacy_only"), true);
});

test("editor appends legacy-only checkpoints in legacy passage order", () => {
  const chapter = cloneChapter(DEMO_CHAPTER);
  const template = chapter.checkpoints[0];
  chapter.body = [];
  chapter.passages = [
    { type: "paragraph", blockId: "legacy_first", passageId: "passage_legacy_first", text: "First." },
    { type: "paragraph", blockId: "legacy_second", passageId: "passage_legacy_second", text: "Second." },
  ];
  chapter.checkpoints = [
    { ...structuredClone(template), checkpointId: "checkpoint_second", passageId: "passage_legacy_second", displayOrder: 0 },
    { ...structuredClone(template), checkpointId: "checkpoint_first", passageId: "passage_legacy_first", displayOrder: 0 },
  ];
  chapter.managedPlacements = [];
  const content = editorDocumentContent(chapter);
  assert.deepEqual(content.map((node) => (node.attrs as Record<string, unknown> | undefined)?.placementId), ["checkpoint_first", "checkpoint_second"]);
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
