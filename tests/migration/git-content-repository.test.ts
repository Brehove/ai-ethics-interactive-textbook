import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitContentRepository } from "../../packages/content-repository/src/index.ts";
import { validateChapter } from "../../workers/content-api/src/services.mjs";

const contentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");
test("Git repository imports the full book deterministically with exact baseline identities", async () => {
  const repository = new GitContentRepository(contentRoot); const first = await repository.exportSnapshot(); const second = await repository.exportSnapshot();
  assert.equal(first.sha256, second.sha256); assert.equal(first.report.chapterCount, 18); assert.equal(first.report.sectionCount, 268); assert.equal(first.report.passageCount, 1939);
  const totalBlocks = Object.values(first.report.blockTypeCounts).reduce((total, count) => total + count, 0);
  assert.ok(first.report.blockTypeCounts.paragraph > 1_000, "ordinary Markdown must become typed paragraphs");
  assert.ok(first.report.legacyMarkupBlocks / totalBlocks < 0.1, `legacy blocks must be bounded; received ${first.report.legacyMarkupBlocks}/${totalBlocks}`);
});
test("every imported chapter is publishable with unique passage identities and resolvable legacy anchors", async () => {
  const repository = new GitContentRepository(contentRoot);
  const book = await repository.getBook();
  for (const chapter of book.chapters) {
    const validation = validateChapter(chapter, { publishable: true });
    assert.deepEqual(validation.errors, [], `${chapter.chapterId} must pass the production publish validator`);
  }
  const chapter2 = await repository.getChapter("ch02");
  const quoteIds = chapter2!.body.filter((block) => block.type === "blockquote" && block.passageId.startsWith("passage_ch02-p0063")).map((block) => block.passageId);
  assert.deepEqual(quoteIds, ["passage_ch02-p0063", "passage_ch02-p0063__2"]);
});
test("Chapter 7 preserves source anchors, checkpoints, and source/world metadata", async () => {
  const repository = new GitContentRepository(contentRoot); const chapter = await repository.getChapter("ch07");
  assert.ok(chapter); assert.equal(chapter!.checkpoints.length, 3); assert.deepEqual(chapter!.checkpoints.map((checkpoint) => checkpoint.slotLabel), ["commit", "work", "reconcile"]); assert.deepEqual(chapter!.checkpoints.map((checkpoint) => checkpoint.displayOrder), [0, 1, 2]);
  assert.ok(chapter!.aliases.some((alias) => alias.fromId === "ch07-p0004")); assert.ok(chapter!.aliases.some((alias) => alias.fromId === "ch07-s001"));
  assert.equal(chapter!.sources.length, 1); assert.deepEqual(chapter!.people[0], { personId: "aristotle", role: "virtue-ethics guide", passageIds: ["passage_ch07-p0006", "passage_ch07-p0010", "passage_ch07-p0036"] });
  assert.equal(chapter!.personFeatures.length, 1); assert.equal(chapter!.managedPlacements.length, 1); assert.equal(chapter!.managedPlacements[0].anchorPassageId, "passage_ch07-p0006");
  assert.ok(chapter!.body.some((block) => block.type === "heading"));
  assert.ok(chapter!.body.some((block) => block.type === "paragraph"));
  assert.ok(chapter!.body.some((block) => block.type === "legacyMarkup" && block.locked));
});

test("world relations and featured person placements survive deterministic backfill", async () => {
  const repository = new GitContentRepository(contentRoot); const first = await repository.getBook(); const second = await repository.getBook();
  const relations = first.chapters.flatMap((chapter) => chapter.people); const placements = first.chapters.flatMap((chapter) => chapter.managedPlacements);
  assert.equal(relations.length, 29); assert.equal(placements.length, 19);
  assert.equal(first.chapters.flatMap((chapter) => chapter.personFeatures).length, 19);
  assert.deepEqual(placements.map((placement) => placement.placementId), second.chapters.flatMap((chapter) => chapter.managedPlacements).map((placement) => placement.placementId));
  for (const chapter of first.chapters) {
    for (const placement of chapter.managedPlacements) {
      assert.match(placement.placementId, /^placement_[a-f0-9]{24}$/);
      assert.equal(chapter.personFeatures.some((feature) => feature.placementId === placement.placementId && feature.personFeatureId === placement.contentId), true);
    }
  }
});

test("featured cards use the legacy reader's first-person-link anchor before world passage fallback", async () => {
  const repository = new GitContentRepository(contentRoot); const chapter = await repository.getChapter("ch05");
  assert.ok(chapter);
  const aquinas = chapter!.managedPlacements.find((placement) => placement.kind === "personFeature");
  assert.equal(aquinas?.anchorPassageId, "passage_ch05-p0007");
  const relation = chapter!.people.find((item) => item.personId === "thomas-aquinas");
  assert.deepEqual(relation?.passageIds, ["passage_ch05-p0030", "passage_ch05-p0031", "passage_ch05-p0034"]);
});

test("D1 migrations establish deterministic placement/checkpoint keys and typed clearance receipts", () => {
  const personMigration = readFileSync(new URL("../../workers/content-api/migrations/0015_person_features_and_flexible_checkpoints.sql", import.meta.url), "utf8");
  const rightsMigration = readFileSync(new URL("../../workers/content-api/migrations/0016_typed_rights_clearance_receipts.sql", import.meta.url), "utf8");
  assert.match(personMigration, /CREATE TABLE person_entity_revisions/); assert.match(personMigration, /CREATE TABLE chapter_person_relations/); assert.match(personMigration, /CREATE TABLE managed_placements/); assert.match(personMigration, /UNIQUE \(document_id, anchor_passage_id, position, order_at_anchor\)/); assert.match(personMigration, /CREATE TABLE chapter_checkpoints/); assert.doesNotMatch(personMigration, /UNIQUE \(document_id, slot_label\)/);
  assert.match(rightsMigration, /CREATE TABLE rights_clearance_receipts/); assert.match(rightsMigration, /basis IN \('humanApproval', 'policy'\)/); assert.match(rightsMigration, /evidence_receipt_id TEXT/); assert.match(rightsMigration, /Preserve media_rights_cases\.status/);
});
