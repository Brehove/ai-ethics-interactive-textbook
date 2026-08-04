import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitContentRepository, sha256, stableStringify } from "../../packages/content-repository/src/index.ts";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.resolve(process.argv[2] ?? "artifacts/migration/seed-content.sql");
const sourceRevision = process.env.CONTENT_SOURCE_REVISION ?? "0a2716182953f492a654aa8b704d420216f39450";
const importedAt = "2026-08-02T00:00:00.000Z";
const quote = (value: string | null) => value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
const splitSqlText = (value: string, maxCodePoints = 12_000) => {
  const points = Array.from(value);
  const chunks: string[] = [];
  for (let index = 0; index < points.length; index += maxCodePoints) chunks.push(points.slice(index, index + maxCodePoints).join(""));
  return chunks;
};

const exported = await new GitContentRepository(path.join(repositoryRoot, "content")).exportSnapshot();
// Wrangler's remote D1 import endpoint rejects explicit BEGIN/COMMIT. Every
// statement below is idempotent so an interrupted seed can be safely retried.
const statements = ["PRAGMA foreign_keys = ON;"];

for (const chapter of exported.snapshot.chapters) {
  const canonicalJson = stableStringify(chapter);
  const contentHash = sha256(canonicalJson);
  const sourcePath = `content/chapters/${chapter.contentKey}/chapter.md`;
  const revisionId = chapter.revisionId;
  const authorityId = `authority_${contentHash.slice(0, 24)}`;
  const metadata = stableStringify({
    schemaVersion: chapter.schemaVersion,
    contentKey: chapter.contentKey,
    slug: chapter.slug,
    bookSnapshotHash: exported.sha256,
    importSource: "git-markdown-v1",
  });
  const contentChunks = splitSqlText(canonicalJson);
  let expectedLength = Array.from(contentChunks[0]).length;

  statements.push(
    `INSERT OR IGNORE INTO documents (id, canonical_path, media_kind, title, state, created_at, updated_at) VALUES (${quote(chapter.chapterId)}, ${quote(sourcePath)}, 'text', ${quote(chapter.title)}, 'active', ${quote(importedAt)}, ${quote(importedAt)});`,
    `INSERT OR IGNORE INTO document_revisions (id, document_id, parent_revision_id, content_hash, content_text, r2_object_key, metadata_json, created_by, created_at) VALUES (${quote(revisionId)}, ${quote(chapter.chapterId)}, NULL, ${quote(contentHash)}, ${quote(contentChunks[0])}, NULL, ${quote(metadata)}, 'service_git_importer', ${quote(importedAt)});`,
    ...contentChunks.slice(1).map((chunk) => {
      const statement = `UPDATE document_revisions SET content_text = content_text || ${quote(chunk)} WHERE id = ${quote(revisionId)} AND length(content_text) = ${expectedLength};`;
      expectedLength += Array.from(chunk).length;
      return statement;
    }),
    `UPDATE documents SET current_revision_id = ${quote(revisionId)}, current_content_hash = ${quote(contentHash)}, updated_at = ${quote(importedAt)} WHERE id = ${quote(chapter.chapterId)} AND (current_revision_id IS NULL OR EXISTS (SELECT 1 FROM authority_registry WHERE document_id = ${quote(chapter.chapterId)} AND active = 1 AND authority = 'git'));`,
    `UPDATE authority_registry SET active = 0, valid_until = ${quote(importedAt)} WHERE document_id = ${quote(chapter.chapterId)} AND active = 1 AND authority = 'git' AND normalized_snapshot_hash <> ${quote(contentHash)};`,
    `UPDATE authority_registry SET authority = 'git', source_path = ${quote(sourcePath)}, normalized_snapshot_hash = ${quote(contentHash)}, active = 1, valid_from = ${quote(importedAt)}, valid_until = NULL WHERE document_id = ${quote(chapter.chapterId)} AND source_revision = ${quote(sourceRevision)} AND NOT EXISTS (SELECT 1 FROM authority_registry active_authority WHERE active_authority.document_id = ${quote(chapter.chapterId)} AND active_authority.active = 1);`,
    `INSERT OR IGNORE INTO authority_registry (id, document_id, authority, source_path, source_revision, normalized_snapshot_hash, active, valid_from, created_at) SELECT ${quote(authorityId)}, ${quote(chapter.chapterId)}, 'git', ${quote(sourcePath)}, ${quote(sourceRevision)}, ${quote(contentHash)}, 1, ${quote(importedAt)}, ${quote(importedAt)} WHERE NOT EXISTS (SELECT 1 FROM authority_registry WHERE document_id = ${quote(chapter.chapterId)} AND active = 1);`,
  );
}

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${statements.join("\n")}\n`);
process.stdout.write(`${JSON.stringify({ output, chapters: exported.snapshot.chapters.length, snapshotHash: exported.sha256, sourceRevision }, null, 2)}\n`);
