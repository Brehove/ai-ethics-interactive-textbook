import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRenderedHtml,
  projectOrderedChapter,
  projectionIdentity,
  renderChapterProjection,
  stripAuthorDecorations,
} from "../../packages/chapter-renderer/src/index.mjs";

const chapter = {
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
  const projection = renderChapterProjection({ title: "Embed", body: [{ type: "externalEmbed", blockId: "block_embed", canonicalUrl: "https://www.youtube.com/watch?v=abc", identity: { provider: "youtube" }, fallback: { title: "Video", summary: "Description", linkLabel: "Watch" } }], checkpoints: [] });
  assert.doesNotMatch(projection.html, /<(?:iframe|script)\b/i);
  assert.match(projection.html, /data-activate-embed="youtube"/);
  assert.match(projection.html, />Watch</);
});

test("author decorations normalize away and identities are key-order stable", async () => {
  assert.equal(stripAuthorDecorations('<p data-author-node="paragraph" contenteditable="true">Text</p>'), "<p>Text</p>");
  assert.equal(await projectionIdentity({ b: 2, a: 1 }), await projectionIdentity({ a: 1, b: 2 }));
});

test("locked legacy markup strips active content", () => {
  const projection = renderChapterProjection({ title: "Legacy", body: [{ type: "legacyMarkup", blockId: "block_legacy", sanitizedHtml: '<p onclick="bad()">Safe</p><script>bad()</script>' }], checkpoints: [] });
  assert.match(projection.html, />Safe</);
  assert.doesNotMatch(projection.html, /onclick|script/i);
});

test("renders the editor's safe underline syntax without exposing raw markup", () => {
  const projection = renderChapterProjection({ title: "Inline", body: [{ type: "paragraph", blockId: "block_inline", passageId: "passage_inline", text: "A ++visible underline++ beside *emphasis*." }], checkpoints: [] });
  assert.match(projection.html, /<u>visible underline<\/u>/);
  assert.match(projection.html, /<em>emphasis<\/em>/);
});
