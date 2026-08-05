import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateChapterV2ToV3, normalizeRenderedHtml, renderChapterProjection } from "../../packages/chapter-renderer/src/index.mjs";
import { GitContentRepository, sha256 } from "../../packages/content-repository/src/index.ts";

export type OrderedFlowMigrationEvidence = {
  chapterId: string;
  sourceRevisionId: string;
  sourceSchemaVersion: 2 | 3;
  sourceHash: string;
  candidateHash: string;
  blockCount: number;
  checkpointCount: number;
  placementCount: number;
  normalizedDomParity: boolean;
  promptOrderParity: boolean;
};

export function migrateChaptersToOrderedFlow(chapters: Array<Record<string, any>>) {
  const candidates: Array<Record<string, any>> = [];
  const evidence: OrderedFlowMigrationEvidence[] = [];
  for (const chapter of chapters) {
    if (![2, 3].includes(chapter.schemaVersion)) throw new Error(`Unsupported schema version for ${chapter.chapterId}`);
    const sourceProjection = renderChapterProjection(chapter);
    const candidate = migrateChapterV2ToV3(chapter);
    const candidateProjection = renderChapterProjection(candidate);
    const normalizedDomParity = normalizeRenderedHtml(sourceProjection.html) === normalizeRenderedHtml(candidateProjection.html);
    const promptOrderParity = JSON.stringify(sourceProjection.prompts.map((item: any) => item.checkpointId)) === JSON.stringify(candidateProjection.prompts.map((item: any) => item.checkpointId));
    if (!normalizedDomParity || !promptOrderParity) throw new Error(`Projection parity failed for ${chapter.chapterId}`);
    candidates.push(candidate);
    evidence.push({
      chapterId: chapter.chapterId,
      sourceRevisionId: chapter.revisionId,
      sourceSchemaVersion: chapter.schemaVersion,
      sourceHash: sha256(chapter),
      candidateHash: sha256(candidate),
      blockCount: candidate.body.filter((node: any) => node.type !== "checkpointRef" && node.type !== "placementRef").length,
      checkpointCount: candidate.checkpoints?.length ?? 0,
      placementCount: candidate.managedPlacements?.length ?? 0,
      normalizedDomParity,
      promptOrderParity,
    });
  }
  return {
    candidates,
    report: {
      schemaVersion: 3,
      chapterCount: evidence.length,
      checkpointCount: evidence.reduce((total, item) => total + item.checkpointCount, 0),
      placementCount: evidence.reduce((total, item) => total + item.placementCount, 0),
      parityPassed: evidence.every((item) => item.normalizedDomParity && item.promptOrderParity),
      evidence,
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const contentRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");
  const snapshot = await new GitContentRepository(contentRoot).getBook();
  const { report } = migrateChaptersToOrderedFlow(snapshot.chapters as Array<Record<string, any>>);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
