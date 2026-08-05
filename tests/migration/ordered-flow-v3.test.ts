import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { GitContentRepository, sha256 } from "../../packages/content-repository/src/index.ts";
import { migrateChaptersToOrderedFlow } from "../../scripts/content/ordered-flow-v3.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");

test("all 18 schema-v2 chapter heads migrate deterministically with DOM and prompt parity", async () => {
  const snapshot = await new GitContentRepository(root).getBook();
  const first = migrateChaptersToOrderedFlow(snapshot.chapters as Array<Record<string, any>>);
  assert.equal(first.report.chapterCount, 18);
  assert.equal(first.report.checkpointCount, 54);
  assert.equal(first.report.parityPassed, true);
  assert.equal(first.candidates.every((chapter) => chapter.schemaVersion === 3), true);
  assert.equal(first.candidates.every((chapter) => chapter.checkpoints.every((item: Record<string, unknown>) => item.displayOrder === undefined)), true);
  assert.equal(first.candidates.every((chapter) => chapter.managedPlacements.every((item: Record<string, unknown>) => item.position === undefined && item.orderAtAnchor === undefined)), true);
  const repeated = migrateChaptersToOrderedFlow(first.candidates);
  assert.deepEqual(repeated.candidates.map(sha256), first.candidates.map(sha256));
  assert.equal(repeated.report.parityPassed, true);
});
