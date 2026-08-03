import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitContentRepository } from "../../packages/content-repository/src/index.ts";

const contentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");
test("Git repository imports the full book deterministically with exact baseline identities", async () => {
  const repository = new GitContentRepository(contentRoot); const first = await repository.exportSnapshot(); const second = await repository.exportSnapshot();
  assert.equal(first.sha256, second.sha256); assert.equal(first.report.chapterCount, 18); assert.equal(first.report.sectionCount, 268); assert.equal(first.report.passageCount, 1939);
  const totalBlocks = Object.values(first.report.blockTypeCounts).reduce((total, count) => total + count, 0);
  assert.ok(first.report.blockTypeCounts.paragraph > 1_000, "ordinary Markdown must become typed paragraphs");
  assert.ok(first.report.legacyMarkupBlocks / totalBlocks < 0.1, `legacy blocks must be bounded; received ${first.report.legacyMarkupBlocks}/${totalBlocks}`);
});
test("Chapter 7 preserves source anchors, checkpoints, and source/world metadata", async () => {
  const repository = new GitContentRepository(contentRoot); const chapter = await repository.getChapter("ch07");
  assert.ok(chapter); assert.equal(chapter!.checkpoints.length, 3); assert.deepEqual(chapter!.checkpoints.map((checkpoint) => checkpoint.slot), ["commit", "work", "reconcile"]);
  assert.ok(chapter!.aliases.some((alias) => alias.fromId === "ch07-p0004")); assert.ok(chapter!.aliases.some((alias) => alias.fromId === "ch07-s001"));
  assert.equal(chapter!.sources.length, 1); assert.equal(chapter!.people[0].entityId, "aristotle");
  assert.ok(chapter!.body.some((block) => block.type === "heading"));
  assert.ok(chapter!.body.some((block) => block.type === "paragraph"));
  assert.ok(chapter!.body.some((block) => block.type === "legacyMarkup" && block.locked));
});
