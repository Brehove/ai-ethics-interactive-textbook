import path from "node:path";
import { GitContentRepository, sha256, stableStringify } from "../../packages/content-repository/src/index.ts";

const url = process.env.SEED_WORKER_URL;
const token = process.env.SEED_TOKEN;
if (!url?.startsWith("https://") || !token) throw new Error("SEED_WORKER_URL and SEED_TOKEN are required");
const sourceRevision = process.env.CONTENT_SOURCE_REVISION ?? "0a2716182953f492a654aa8b704d420216f39450";
const exported = await new GitContentRepository(path.resolve("content")).exportSnapshot();
for (const chapter of exported.snapshot.chapters) {
  const contentText = stableStringify(chapter);
  const contentHash = sha256(contentText);
  const response = await fetch(new URL("/seed", url), { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({
    chapterId: chapter.chapterId, revisionId: chapter.revisionId, contentHash, contentText, title: chapter.title,
    sourcePath: `content/chapters/${chapter.contentKey}/chapter.md`, sourceRevision,
    metadataJson: stableStringify({ schemaVersion: chapter.schemaVersion, contentKey: chapter.contentKey, slug: chapter.slug, bookSnapshotHash: exported.sha256, importSource: "git-markdown-v1" }),
  }) });
  if (!response.ok) throw new Error(`Seed failed for ${chapter.chapterId}: ${response.status} ${await response.text()}`);
}
process.stdout.write(`${JSON.stringify({ seeded: exported.snapshot.chapters.length, snapshotHash: exported.sha256 })}\n`);
