import assert from "node:assert/strict";
import test from "node:test";
import { legacyCuratedArtifacts } from "../src/generated-legacy-artifacts";
import { renderLegacyCuratedArtifact } from "../src/tiptap-editor";

test("Chapter 7 editor sidecar renders both reviewed Wikimedia artifacts at their reader anchors", () => {
  const artifacts = legacyCuratedArtifacts.filter((item) => item.chapterId === "chapter_ch07");
  assert.equal(artifacts.length, 2);
  assert.deepEqual(artifacts.map((item) => item.anchorPassageId).sort(), ["passage_ch07-p0006", "passage_ch07-p0036"]);
  for (const artifact of artifacts) {
    const html = renderLegacyCuratedArtifact(artifact);
    assert.match(html, /<img src="https:\/\/ethicsandai\.your-digital-life\.org\/media\/wikimedia\//);
    assert.match(html, /<figcaption>/);
    assert.match(html, /Source and rights/);
    assert.match(html, /Commons record/);
  }
});
