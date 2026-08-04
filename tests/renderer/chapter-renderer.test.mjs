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
