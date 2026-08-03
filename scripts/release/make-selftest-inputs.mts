import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { GitContentRepository, sha256, stableStringify } from "../../packages/content-repository/src/index.ts";
import { BookReleaseSnapshotSchema, PublishableChapterBundleSchema } from "../../packages/content-contract/src/index.ts";
import { assembleReleaseSnapshot } from "./release.mjs";

const outputDir = path.resolve(process.argv[2] ?? "artifacts/release-selftest");
const exported = await new GitContentRepository(path.resolve("content")).exportSnapshot();
const source = exported.snapshot.chapters.find((chapter) => chapter.chapterId === "chapter_ch07");
if (!source) throw new Error("Chapter 7 is missing from the Git baseline");

// Mirror the Content API's deterministic finalization using a fixed actor and
// timestamp so the local canary remains reproducible.
const editorialContentHash = sha256(stableStringify(source));
const revisionId = `revision_${editorialContentHash.slice(0, 24)}`;
const content = {
  ...structuredClone(source),
  revisionId,
  chapterVersion: revisionId,
  status: "published" as const,
  updatedBy: { actorId: "actor_release_selftest", actorType: "service" as const },
  updatedAt: "2026-08-03T00:00:00.000Z",
};
PublishableChapterBundleSchema.parse(content);
const submittedContentHash = sha256(stableStringify(content));
const submitted = {
  schemaVersion: 1,
  changesetId: "changeset_release_selftest",
  documents: [{
    documentId: "chapter_ch07",
    baseRevisionId: source.revisionId,
    editorialContentHash,
    submittedContentHash,
    revisionId,
    content,
  }],
};
const release = assembleReleaseSnapshot({ submittedSnapshot: submitted, baselineSnapshot: exported.snapshot });
BookReleaseSnapshotSchema.parse(release);

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, "baseline.json"), `${stableStringify(exported.snapshot)}\n`),
  writeFile(path.join(outputDir, "submitted.json"), `${stableStringify(submitted)}\n`),
]);
process.stdout.write(`${JSON.stringify({ outputDir, editorialContentHash, submittedContentHash, snapshotHash: sha256(stableStringify(submitted)), revisionId })}\n`);
