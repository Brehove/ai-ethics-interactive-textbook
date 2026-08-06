import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAPTER_RENDERER_STYLES,
  ChapterFlowError,
  exportChapterV3AsV2,
  migrateChapterV2ToV3,
  migrateChapterV3ToV4,
  normalizeRenderedHtml,
  projectOrderedChapter,
  projectionIdentity,
  renderChapterProjection,
  stripAuthorDecorations,
} from "../../packages/chapter-renderer/src/index.mjs";

test("person cards respond to their actual card container width", () => {
  assert.match(CHAPTER_RENDERER_STYLES, /\.chapter-person\{container-type:inline-size/);
  assert.match(CHAPTER_RENDERER_STYLES, /@container \(min-width:26rem\)\{\.chapter-person__content\{grid-template-columns:minmax\(8rem,34%\) 1fr\}/);
  assert.match(CHAPTER_RENDERER_STYLES, /@media\(max-width:720px\)[^}]*[\s\S]*\.chapter-person__content\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(CHAPTER_RENDERER_STYLES, /\.chapter-layout--card-grid>\.chapter-person/);
});

const chapter = {
  schemaVersion: 2,
  revisionId: "revision_demo",
  chapterVersion: "7",
  title: "Demo",
  body: [
    { type: "paragraph", blockId: "block_a", passageId: "passage_a", text: "Before **Aristotle**." },
    { type: "paragraph", blockId: "block_b", passageId: "passage_b", text: "After." },
  ],
  checkpoints: [
    { checkpointId: "checkpoint_second", passageId: "passage_a", displayOrder: 2, title: "Second", prompt: "Revise.", showInSidebar: true },
    { checkpointId: "checkpoint_first", passageId: "passage_a", displayOrder: 1, title: "First", prompt: "Commit.", showInSidebar: true },
  ],
  personFeatures: [{ personFeatureId: "personfeature_aristotle", placementId: "placement_aristotle", personId: "aristotle", name: "Aristotle", biography: "Greek philosopher", portrait: { src: "/media/aristotle.webp", alt: "Portrait of Aristotle", credit: "Public domain" }, primarySources: [{ title: "Nicomachean Ethics" }] }],
  managedPlacements: [{ kind: "personFeature", placementId: "placement_aristotle", contentId: "personfeature_aristotle", anchorPassageId: "passage_a", position: "after", orderAtAnchor: 0 }],
};

test("ordered projection interleaves managed content deterministically", () => {
  const nodes = projectOrderedChapter(chapter);
  assert.deepEqual(nodes.map((node) => `${node.kind}:${node.value.placementId || node.value.checkpointId || node.value.blockId}`), [
    "block:block_a", "personFeature:placement_aristotle", "checkpoint:checkpoint_first", "checkpoint:checkpoint_second", "block:block_b",
  ]);
});

test("reader and editor projection share identical canonical markup", () => {
  const reader = renderChapterProjection(chapter, { context: "reader" });
  const editor = renderChapterProjection(chapter, { context: "editor" });
  assert.equal(normalizeRenderedHtml(reader.html), normalizeRenderedHtml(editor.html));
  assert.deepEqual(reader.prompts.map((prompt) => prompt.checkpointId), ["checkpoint_first", "checkpoint_second"]);
  assert.match(reader.html, /chapter-person/);
  assert.match(reader.html, /checkpoint_first/);
  assert.match(reader.html, /https:\/\/ethicsandai\.your-digital-life\.org\/media\/aristotle\.webp/);
  assert.match(reader.html, /Nicomachean Ethics/);
});

test("schema-v2 migration materializes one authoritative flow with normalized DOM parity", () => {
  const v2 = structuredClone(chapter);
  const v3 = migrateChapterV2ToV3(v2);
  assert.equal(v3.schemaVersion, 3);
  assert.deepEqual(v3.body.map((node) => node.type), ["paragraph", "placementRef", "checkpointRef", "checkpointRef", "paragraph"]);
  assert.equal(v3.checkpoints.every((item) => item.displayOrder === undefined), true);
  assert.equal(v3.managedPlacements.every((item) => item.position === undefined && item.orderAtAnchor === undefined), true);
  assert.equal(normalizeRenderedHtml(renderChapterProjection(v2).html), normalizeRenderedHtml(renderChapterProjection(v3).html));
  assert.deepEqual(renderChapterProjection(v3).prompts.map((item) => item.checkpointId), ["checkpoint_first", "checkpoint_second"]);
  assert.equal(renderChapterProjection(v2).projectionProvenance, "v2-anchor-adapter");
  assert.equal(renderChapterProjection(v3).projectionProvenance, "v3-flow");
  assert.deepEqual(migrateChapterV2ToV3(v3), v3);
});

test("schema-v3 flow rejects duplicate, orphaned, and unresolved references", () => {
  const migrated = migrateChapterV2ToV3(chapter);
  const checkpointRef = migrated.body.find((node) => node.type === "checkpointRef");
  assert.ok(checkpointRef);
  assert.throws(
    () => projectOrderedChapter({ ...migrated, body: [...migrated.body, checkpointRef] }),
    (error) => error instanceof ChapterFlowError && error.code === "CHECKPOINT_REFERENCE_DUPLICATE",
  );
  assert.throws(
    () => projectOrderedChapter({ ...migrated, body: migrated.body.filter((node) => node !== checkpointRef) }),
    (error) => error instanceof ChapterFlowError && error.code === "CHECKPOINT_REFERENCE_ORPHAN",
  );
  assert.throws(
    () => projectOrderedChapter({ ...migrated, body: [...migrated.body, { type: "checkpointRef", checkpointId: "checkpoint_missing" }] }),
    (error) => error instanceof ChapterFlowError && error.code === "CHECKPOINT_REFERENCE_MISSING",
  );
  assert.throws(
    () => projectOrderedChapter({ ...chapter, schemaVersion: 3 }),
    (error) => error instanceof ChapterFlowError && error.code === "CHECKPOINT_REFERENCE_ORPHAN",
  );
});

test("schema-v4 renders semantic card grids and preserves ordered source in print", () => {
  const v4 = migrateChapterV3ToV4(migrateChapterV2ToV3(chapter));
  const first = { type: "artifactCard", blockId: "block_artifact_one", artifactId: "artifact_one", title: "Practice", summary: "A practice artifact.", teachingUse: "Compare it.", presentation: { width: "medium", align: "center", density: "compact" } };
  const second = { type: "artifactCard", blockId: "block_artifact_two", artifactId: "artifact_two", title: "Judgment", summary: "A judgment artifact.", teachingUse: "Compare it.", presentation: { width: "medium", align: "center", density: "compact" } };
  v4.body.push(first, second);
  v4.layoutRegions = [{ layoutId: "layout_pair", type: "card-grid", startNodeId: first.blockId, endNodeId: second.blockId, cardNodeIds: [first.blockId, second.blockId], columns: 2, emphasis: "equal", ratio: "start-narrow" }];
  const rendered = renderChapterProjection(v4);
  assert.equal(rendered.projectionProvenance, "v4-layout-flow");
  assert.match(rendered.html, /chapter-layout--card-grid/);
  assert.match(rendered.html, /--grid-columns:2/);
  assert.match(rendered.html, /data-ratio="start-narrow"/);
  assert.match(CHAPTER_RENDERER_STYLES, /data-ratio="start-narrow"\]\{grid-template-columns:minmax\(14rem,.7fr\) minmax\(0,1.3fr\)/);
  assert.ok(rendered.html.indexOf("Practice") < rendered.html.indexOf("Judgment"));
  assert.match(rendered.html, /data-layout-catalog-version="2026-08-06"/);
});

test("schema-v4 split layouts preserve source order while assigning either visual side", () => {
  const v4 = migrateChapterV3ToV4(migrateChapterV2ToV3({ ...chapter, checkpoints: [], managedPlacements: [], personFeatures: [] }));
  const card = { type: "artifactCard", blockId: "block_split_card", artifactId: "artifact_split", title: "Aristotle", summary: "A thinker card.", teachingUse: "Read beside the argument.", presentation: { width: "narrow", align: "center", density: "compact" } };
  v4.body.push(card);
  v4.layoutRegions = [{ layoutId: "layout_split", type: "card-text-split", startNodeId: "block_b", endNodeId: card.blockId, cardNodeIds: [card.blockId], textNodeIds: ["block_b"], cardSide: "start", ratio: "card-narrow" }];
  const rendered = renderChapterProjection(v4);
  assert.match(rendered.html, /chapter-layout--card-text-split/);
  assert.match(rendered.html, /data-card-side="start"/);
  assert.ok(rendered.html.indexOf("chapter-layout__text") < rendered.html.indexOf("chapter-layout__cards"));
  assert.match(rendered.html, /--split-columns:minmax\(14rem,.7fr\) 1.3fr/);
});

test("legacy export derives anchor positions without introducing a second v3 ordering source", () => {
  const v3 = migrateChapterV2ToV3(chapter);
  const exported = exportChapterV3AsV2(v3);
  assert.equal(exported.schemaVersion, 2);
  assert.equal(exported.body.some((node) => node.type === "checkpointRef" || node.type === "placementRef"), false);
  assert.equal(normalizeRenderedHtml(renderChapterProjection(exported).html), normalizeRenderedHtml(renderChapterProjection(v3).html));
});

test("checkpoint ID deterministically breaks shared anchor and display-order ties", () => {
  const tied = {
    ...chapter,
    checkpoints: [
      { ...chapter.checkpoints[0], checkpointId: "checkpoint_z", displayOrder: 1 },
      { ...chapter.checkpoints[1], checkpointId: "checkpoint_a", displayOrder: 1 },
    ],
    managedPlacements: [{ ...chapter.managedPlacements[0], orderAtAnchor: 1 }],
  };
  const forward = renderChapterProjection(tied);
  const reverse = renderChapterProjection({ ...tied, checkpoints: [...tied.checkpoints].reverse() });
  assert.deepEqual(forward.prompts.map((prompt) => prompt.checkpointId), ["checkpoint_a", "checkpoint_z"]);
  assert.deepEqual(forward.orderedNodes.filter((node) => node.kind !== "block").map((node) => node.value.checkpointId || node.value.placementId), ["checkpoint_a", "checkpoint_z", "placement_aristotle"]);
  assert.equal(forward.html, reverse.html);
  assert.deepEqual(forward.prompts, reverse.prompts);
});

test("shared passage anchors emit each checkpoint and managed placement once", () => {
  const repeatedAnchorChapter = {
    ...chapter,
    body: [
      chapter.body[0],
      { type: "codeBlock", blockId: "block_code_a", anchorPassageId: "passage_a", code: "same anchor" },
      chapter.body[1],
    ],
  };
  const projection = renderChapterProjection(repeatedAnchorChapter);
  assert.equal(projection.orderedNodes.filter((node) => node.kind === "checkpoint").length, 2);
  assert.equal(projection.orderedNodes.filter((node) => node.kind === "personFeature").length, 1);
  assert.deepEqual(projection.prompts.map((prompt) => prompt.checkpointId), ["checkpoint_first", "checkpoint_second"]);
  assert.equal((projection.html.match(/data-checkpoint-id=/g) || []).length, 2);
});

test("sidebar prompts backed only by the legacy passages collection are retained", () => {
  const legacyPassageChapter = {
    ...chapter,
    passages: [{ passageId: "passage_legacy_only", text: "Legacy passage." }],
    checkpoints: [{ checkpointId: "checkpoint_legacy_only", passageId: "passage_legacy_only", displayOrder: 0, title: "Legacy prompt", prompt: "Respond.", showInSidebar: true }],
    managedPlacements: [],
  };
  const projection = renderChapterProjection(legacyPassageChapter);
  assert.deepEqual(projection.prompts.map((prompt) => prompt.checkpointId), ["checkpoint_legacy_only"]);
  assert.equal(projection.orderedNodes.at(-1).value.checkpointId, "checkpoint_legacy_only");
});

test("legacy-only prompt anchors follow legacy passage order rather than checkpoint storage order", () => {
  const legacyPassageChapter = {
    ...chapter,
    passages: [{ passageId: "passage_legacy_first", text: "First." }, { passageId: "passage_legacy_second", text: "Second." }],
    checkpoints: [
      { checkpointId: "checkpoint_second", passageId: "passage_legacy_second", displayOrder: 0, title: "Second", prompt: "Second prompt.", showInSidebar: true },
      { checkpointId: "checkpoint_first", passageId: "passage_legacy_first", displayOrder: 0, title: "First", prompt: "First prompt.", showInSidebar: true },
    ],
    managedPlacements: [],
  };
  const projection = renderChapterProjection(legacyPassageChapter);
  assert.deepEqual(projection.prompts.map((prompt) => prompt.checkpointId), ["checkpoint_first", "checkpoint_second"]);
});

test("anchored managed blocks do not steal checkpoint placement from the owning passage", () => {
  const mediaBeforeOwner = {
    ...chapter,
    body: [
      { type: "mediaFigure", blockId: "block_media_a", anchorPassageId: "passage_a", caption: "Context image" },
      chapter.body[0],
      chapter.body[1],
    ],
  };
  const nodes = projectOrderedChapter(mediaBeforeOwner);
  const ids = nodes.map((node) => node.value.blockId || node.value.placementId || node.value.checkpointId);
  assert.ok(ids.indexOf("block_media_a") < ids.indexOf("block_a"));
  assert.ok(ids.indexOf("block_a") < ids.indexOf("checkpoint_first"));
  assert.equal(nodes.filter((node) => node.kind === "checkpoint").length, 2);
});

test("semantic person relations do not implicitly create scholar cards", () => {
  const projection = renderChapterProjection({ ...chapter, managedPlacements: [], personFeatures: [], people: [{ personId: "aristotle", role: "mentioned", passageIds: ["passage_a"] }] });
  assert.doesNotMatch(projection.html, /chapter-person/);
});

test("managed placements honor before and after positions", () => {
  const beforeChapter = { ...chapter, managedPlacements: [{ ...chapter.managedPlacements[0], position: "before" }] };
  const projection = renderChapterProjection(beforeChapter);
  assert.ok(projection.html.indexOf("chapter-person") < projection.html.indexOf("block_a"));
});

test("provider embeds remain fallback-first without iframe or script requests", () => {
  const projection = renderChapterProjection({ schemaVersion: 2, title: "Embed", body: [{ type: "externalEmbed", blockId: "block_embed", canonicalUrl: "https://www.youtube.com/watch?v=abc", identity: { provider: "youtube" }, fallback: { title: "Video", summary: "Description", linkLabel: "Watch" } }], checkpoints: [] });
  assert.doesNotMatch(projection.html, /<(?:iframe|script)\b/i);
  assert.match(projection.html, /data-activate-embed="youtube"/);
  assert.match(projection.html, />Watch</);
});

test("author decorations normalize away and identities are key-order stable", async () => {
  assert.equal(stripAuthorDecorations('<p data-author-node="paragraph" contenteditable="true">Text</p>'), "<p>Text</p>");
  assert.equal(await projectionIdentity({ b: 2, a: 1 }), await projectionIdentity({ a: 1, b: 2 }));
});

test("locked legacy markup strips active content", () => {
  const projection = renderChapterProjection({ schemaVersion: 2, title: "Legacy", body: [{ type: "legacyMarkup", blockId: "block_legacy", sanitizedHtml: '<p onclick="bad()">Safe</p><script>bad()</script>' }], checkpoints: [] });
  assert.match(projection.html, />Safe</);
  assert.doesNotMatch(projection.html, /onclick|script/i);
});

test("renders the editor's safe underline syntax without exposing raw markup", () => {
  const projection = renderChapterProjection({ schemaVersion: 2, title: "Inline", body: [{ type: "paragraph", blockId: "block_inline", passageId: "passage_inline", text: "A ++visible underline++ beside *emphasis*." }], checkpoints: [] });
  assert.match(projection.html, /<u>visible underline<\/u>/);
  assert.match(projection.html, /<em>emphasis<\/em>/);
});
