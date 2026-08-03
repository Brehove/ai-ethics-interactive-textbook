/**
 * Fail-closed release primitives.  These functions deliberately know nothing
 * about GitHub Actions or Cloudflare credentials; callers supply an adapter.
 */
import { createHash, sign, verify } from "node:crypto";
import { mkdir, readFile, writeFile, rename, cp } from "node:fs/promises";
import path from "node:path";

export const CANARY_D1_DOCUMENT = "chapter_ch07";
export const sha256 = (value) => createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
const RELEASE_ASSET_ORIGIN = "https://auth.ethicsandai.your-digital-life.org";
const SAFE_MIME = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"], ["image/gif", "gif"], ["audio/mpeg", "mp3"], ["audio/mp4", "m4a"], ["video/mp4", "mp4"], ["application/pdf", "pdf"], ["text/plain", "txt"]]);
export async function materializeReleaseAssets({ projection, publicDir, token, fetcher = fetch }) {
  if (!token) fail("E_RELEASE_ASSET_TOKEN", "RELEASE_ASSET_TOKEN is required for content-addressed media materialization.");
  if (!projection || !Array.isArray(projection.assets) || !Array.isArray(projection.versions)) fail("E_MEDIA_PROJECTION", "Submitted snapshot must include mediaProjection assets and versions.");
  if (projection.assets.length > 64 || projection.assets.reduce((sum, asset) => sum + (Number.isInteger(asset?.bytes) ? asset.bytes : 0), 0) > 256 * 1024 * 1024) fail("E_MEDIA_PROJECTION", "Submitted media projection exceeds release limits.");
  await mkdir(publicDir, { recursive: true }); const assets = []; const written = new Map();
  for (const asset of projection.assets) {
    if (!/^[a-f0-9]{64}$/.test(asset.sha256 || "") || !Number.isInteger(asset.bytes) || asset.bytes < 1 || !SAFE_MIME.has(asset.mimeType)) fail("E_MEDIA_PROJECTION", "Media projection asset is invalid.");
    if (asset.downloadPath !== `/v1/release-assets/${asset.sha256}`) fail("E_MEDIA_PROJECTION", "Media projection download path is not hash-bound.");
    const prior = written.get(asset.sha256);
    if (prior && (prior.bytes !== asset.bytes || prior.mimeType !== asset.mimeType)) fail("E_MEDIA_PROJECTION", "Duplicate media digest has conflicting metadata.");
    if (prior) { assets.push({ ...asset, publicPath: prior.publicPath }); continue; }
    const response = await fetcher(`${RELEASE_ASSET_ORIGIN}/v1/release-assets/${asset.sha256}`, { headers: { authorization: `Bearer ${token}`, accept: asset.mimeType } });
    if (!response.ok) fail("E_RELEASE_ASSET_STATUS", `Release asset ${asset.sha256} returned ${response.status}.`);
    if (response.headers.get("content-type")?.split(";")[0] !== asset.mimeType) fail("E_RELEASE_ASSET_MIME", "Release asset MIME does not match projection.");
    const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.byteLength !== asset.bytes) fail("E_RELEASE_ASSET_SIZE", "Release asset size does not match projection."); if (sha256(bytes) !== asset.sha256) fail("E_RELEASE_ASSET_HASH", "Release asset hash does not match projection.");
    const filename = `${asset.sha256}.${SAFE_MIME.get(asset.mimeType)}`; await writeFile(path.join(publicDir, filename), bytes, { flag: "wx" });
    const publicPath = `/release-assets/${filename}`; written.set(asset.sha256, { bytes: asset.bytes, mimeType: asset.mimeType, publicPath }); assets.push({ ...asset, publicPath });
  } return assets;
}
export function assertCanary(snapshot) {
  const d1 = Object.entries(snapshot.authorityRegistry ?? {}).filter(([, source]) => source.authority === "d1").map(([id]) => id);
  if (d1.some((id) => id !== CANARY_D1_DOCUMENT) || (d1.length && !d1.includes(CANARY_D1_DOCUMENT))) fail("E_CANARY_POLICY", "Canary permits D1 authority only for Chapter 7 (chapter_ch07).");
}
/** Bind a submitted one-document D1 snapshot into an otherwise Git-authoritative full book snapshot. */
export function assembleReleaseSnapshot({ submittedSnapshot, baselineSnapshot }) {
  const document = submittedSnapshot?.documents?.find((item) => item.documentId === CANARY_D1_DOCUMENT);
  if (!document?.content || submittedSnapshot.documents.length !== 1) fail("E_SUBMITTED_SCOPE", "A canary submission must contain exactly Chapter 7.");
  const finalizedChapter = document.content;
  const finalizedHash = sha256(finalizedChapter);
  if (!/^[a-f0-9]{64}$/i.test(document.submittedContentHash ?? "") || finalizedHash !== document.submittedContentHash) {
    fail("E_SUBMITTED_CONTENT_HASH", "Submitted Chapter 7 bytes do not match the immutable submitted content hash.");
  }
  if (document.revisionId !== finalizedChapter.revisionId || finalizedChapter.chapterVersion !== document.revisionId || finalizedChapter.status !== "published") {
    fail("E_SUBMITTED_FINALIZATION", "Submitted Chapter 7 was not server-finalized into the declared publishable revision.");
  }
  const chapters = baselineSnapshot?.chapters?.map((chapter) => chapter.chapterId === CANARY_D1_DOCUMENT ? finalizedChapter : chapter);
  if (!chapters?.some((chapter) => chapter.chapterId === CANARY_D1_DOCUMENT)) fail("E_CANARY_MISSING", "Git baseline does not contain Chapter 7.");
  const authorityRegistry = { ...baselineSnapshot.authorityRegistry, [CANARY_D1_DOCUMENT]: { authority: "d1", documentId: CANARY_D1_DOCUMENT, domainRevisionId: finalizedChapter.revisionId, normalizedSnapshotHash: finalizedHash } };
  const contentObjects = { ...baselineSnapshot.contentObjects, [CANARY_D1_DOCUMENT]: { type: "chapter", domainRevisionId: finalizedChapter.revisionId, sha256: finalizedHash } };
  const releaseSnapshot = { ...baselineSnapshot, chapters, authorityRegistry, contentObjects, ...(submittedSnapshot.mediaProjection ? { mediaProjection: submittedSnapshot.mediaProjection } : {}) };
  assertCanary(releaseSnapshot); return releaseSnapshot;
}
function decodeImportedLegacy(block) {
  if (/_metadata$/.test(block.blockId)) return "";
  const match = block.sanitizedHtml.match(/^<pre data-content-source="git-markdown-v1">([\s\S]*)<\/pre>$/);
  if (!match) fail("E_LEGACY_PROJECTION", `Legacy block ${block.blockId} does not use the reviewed Git-import envelope.`);
  return match[1].replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#039;", "'").replaceAll("&amp;", "&");
}
function markdownForBlock(block, includePassageMarker = true) {
  if (block.type === "heading") return `<!-- phil-section-id: ${block.sectionId.replace(/^section_/, "")} -->\n${"#".repeat(block.level)} ${block.text}`;
  const anchor = block.passageId || block.anchorPassageId; const prefix = includePassageMarker && anchor ? `<!-- phil-passage-id: ${anchor.replace(/^passage_/, "")} -->\n` : "";
  if (block.type === "paragraph") return `${prefix}${block.text}`;
  if (block.type === "blockquote") return `${prefix}${block.text.split("\n").map(x => `> ${x}`).join("\n")}`;
  if (block.type === "list") return `${prefix}${block.items.map((x, i) => `${block.ordered ? `${i + 1}.` : "-"} ${x}`).join("\n")}`;
  if (block.type === "codeBlock") return `${prefix}\`\`\`${block.language || ""}\n${block.code}\n\`\`\``;
  if (block.type === "table") return `${prefix}| ${block.columns.join(" | ")} |\n| ${block.columns.map(() => "---").join(" | ")} |\n${block.rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}`;
  if (block.type === "callout") return `${prefix}> **${block.tone[0].toUpperCase()}${block.tone.slice(1)}:** ${block.text.replaceAll("\n", "\n> ")}`;
  if (block.type === "diagram") return `${prefix}> **Diagram:** ${block.description}`;
  if (block.type === "legacyMarkup") return decodeImportedLegacy(block);
  if (["externalEmbed", "richLink", "mediaFigure"].includes(block.type)) return "";
  fail("E_BLOCK_PROJECTION", `No reviewed Markdown projection exists for block type ${block.type}.`);
}
export async function materializeChapterSeven({ sourceRoot, workspace, releaseSnapshot, releaseAssetToken, fetcher }) {
  await cp(sourceRoot, workspace, { recursive: true, filter: (entry) => {
    const first = path.relative(sourceRoot, entry).split(path.sep)[0];
    return !["node_modules", ".git", "dist", "artifacts", ".wrangler"].includes(first);
  } });
  const chapter = releaseSnapshot.chapters.find((item) => item.chapterId === CANARY_D1_DOCUMENT); if (!chapter) fail("E_CANARY_MISSING", "Release snapshot has no Chapter 7.");
  const dir = path.join(workspace, "content/chapters/07-aristotle-character-and-ai-assisted-life");
  let priorPassage = null;
  const markdownBlocks = chapter.body.map((block) => {
    const passage = block.passageId || block.anchorPassageId || null;
    const rendered = markdownForBlock(block, !passage || passage !== priorPassage);
    if (passage) priorPassage = passage;
    return rendered;
  }).filter(Boolean);
  await writeFile(path.join(dir, "chapter.md"), `# ${chapter.title}\n\n${markdownBlocks.join("\n\n")}\n`);
  const record = JSON.parse(await readFile(path.join(dir, "reading-record.json"), "utf8"));
  record.reasoningObjective = chapter.reasoningObjective; record.checkpoints = chapter.checkpoints.map((item) => ({ id: item.legacyId || item.checkpointId.replace(/^checkpoint_/, ""), passageId: item.passageId.replace(/^passage_/, ""), stage: item.stage, strategy: item.strategy, title: item.title, trigger: item.trigger, prompt: item.prompt, guidance: item.guidance, responseStructure: item.responseStructure || item.responseFormat, minWords: item.minWords, maxWords: item.maxWords, showInSidebar: item.showInSidebar, rationale: item.rationale }));
  await writeFile(path.join(dir, "reading-record.json"), `${JSON.stringify(record, null, 2)}\n`);
  const materializedAssets = releaseSnapshot.mediaProjection ? await materializeReleaseAssets({ projection: releaseSnapshot.mediaProjection, publicDir: path.join(workspace, "public/release-assets"), token: releaseAssetToken, fetcher }) : [];
  const placements = chapter.body.filter((block) => ["externalEmbed", "richLink", "mediaFigure"].includes(block.type)).map((block) => {
    if (block.type === "mediaFigure") {
      const version = releaseSnapshot.mediaProjection?.versions?.find((item) => item.mediaVersionId === block.mediaVersionId);
      if (!version || version.rights?.rightsCaseId !== block.rightsCaseId || version.rights?.status !== "cleared") fail("E_MEDIA_RIGHTS", `Media figure ${block.figureId} lacks an exact cleared projected media version.`);
      const versionAssets = materializedAssets.filter((item) => item.mediaVersionId === block.mediaVersionId);
      const primary = versionAssets.find((item) => ["display", "animation", "audio", "video", "document"].includes(item.role)) ?? versionAssets.find((item) => item.role !== "poster");
      if (!primary) fail("E_MEDIA_NOT_MATERIALIZED", `Media figure ${block.figureId} lacks an exact projected media version.`);
      const poster = versionAssets.find((item) => item.role === "poster");
      const detectedMime = primary.mimeType;
      const kind = version.kind ?? (detectedMime.startsWith("image/") ? (poster ? "gif" : "image") : detectedMime.startsWith("audio/") ? "audio" : detectedMime.startsWith("video/") ? "video" : detectedMime === "application/pdf" ? "pdf" : detectedMime === "text/plain" ? "document" : null);
      if (!kind) fail("E_MEDIA_PROJECTION", `Media figure ${block.figureId} has no supported release kind.`);
      return { type: block.type, blockId: block.blockId, anchorPassageId: block.anchorPassageId, figureId: block.figureId, mediaId: block.mediaId, mediaVersionId: block.mediaVersionId, rightsCaseId: block.rightsCaseId, kind, src: primary.publicPath, ...(poster ? { poster: poster.publicPath } : {}), title: version.title, downloadName: `${version.title || block.figureId}.${SAFE_MIME.get(primary.mimeType)}`.replace(/[^A-Za-z0-9._-]+/g, "-"), alt: block.alt, caption: block.caption, captionOmissionReason: block.captionOmissionReason, teachingUse: block.teachingUse, credit: block.creditOverride ?? version.rights?.credit ?? "Source and rights recorded in this release.", transcript: version.transcriptEquivalent?.text ?? version.technical?.transcriptEquivalent?.text, mimeType: detectedMime, downloadable: block.downloadable, printPolicy: block.printPolicy, displayPreset: block.displayPreset, align: block.align };
    }
    return { type: block.type, blockId: block.blockId, anchorPassageId: block.anchorPassageId, ...(block.type === "externalEmbed" ? { identity: block.identity, canonicalUrl: block.canonicalUrl, caption: block.caption, teachingUse: block.teachingUse, fallback: block.fallback, adapterVersion: block.adapterVersion } : {}), ...(block.type === "richLink" ? { canonicalUrl: block.canonicalUrl, title: block.title, summary: block.summary, linkLabel: block.linkLabel, teachingUse: block.teachingUse } : {}) };
  });
  const sidecar = path.join(dir, "release-placements.json"); await writeFile(sidecar, `${JSON.stringify({ schemaVersion: 1, chapterId: chapter.chapterId, placements }, null, 2)}\n`);
  return { chapterPath: path.join(dir, "chapter.md"), readingRecordPath: path.join(dir, "reading-record.json"), placementsPath: sidecar, chapterDigest: sha256(await readFile(path.join(dir, "chapter.md"))), readingRecordDigest: sha256(await readFile(path.join(dir, "reading-record.json"))), placementsDigest: sha256(await readFile(sidecar)) };
}
export function makeCandidate({ snapshot, submittedSnapshot = snapshot, releaseSnapshot = snapshot, snapshotHash, snapshotRevision, commitSha, createdAt = new Date().toISOString(), signingKey }) {
  if (!/^[a-f0-9]{64}$/i.test(snapshotHash)) fail("E_SNAPSHOT_HASH", "snapshotHash must be a SHA-256 hex digest.");
  if (!snapshotRevision || typeof snapshotRevision !== "string") fail("E_SNAPSHOT_REVISION", "snapshotRevision is required.");
  const actual = sha256(submittedSnapshot);
  if (actual !== snapshotHash) fail("E_SNAPSHOT_HASH_MISMATCH", "Submitted snapshot bytes do not match the requested immutable snapshot hash.");
  assertCanary(releaseSnapshot);
  const unsigned = { schemaVersion: 1, candidateId: `candidate_${snapshotHash.slice(0, 24)}`, createdAt, submittedSnapshot: { sha256: snapshotHash, revision: snapshotRevision, bytes: Buffer.byteLength(stableJson(submittedSnapshot)), value: submittedSnapshot }, releaseSnapshot, code: { commitSha }, canary: { d1AuthoritativeDocuments: Object.entries(releaseSnapshot.authorityRegistry ?? {}).filter(([, v]) => v.authority === "d1").map(([id]) => id) } };
  const manifestSha256 = sha256(unsigned);
  const signature = signingKey ? sign(null, Buffer.from(manifestSha256), signingKey).toString("base64") : null;
  return { ...unsigned, manifestSha256, signature, signatureAlgorithm: signature ? "ed25519" : null };
}
export function verifyCandidate(candidate, publicKey, { requireSignature = true } = {}) {
  const { manifestSha256, signature, signatureAlgorithm, ...unsigned } = candidate;
  if (sha256(unsigned) !== manifestSha256) fail("E_MANIFEST_HASH_MISMATCH", "Candidate manifest has been modified.");
  if (sha256(candidate.submittedSnapshot.value) !== candidate.submittedSnapshot.sha256) fail("E_STALE_SNAPSHOT", "Candidate no longer contains its submitted snapshot.");
  assertCanary(candidate.releaseSnapshot);
  if (requireSignature && (!signature || signatureAlgorithm !== "ed25519" || !publicKey || !verify(null, Buffer.from(manifestSha256), publicKey, Buffer.from(signature, "base64")))) fail("E_SIGNATURE_INVALID", "Candidate signature is missing or invalid.");
  return true;
}
export async function writeJsonImmutable(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  try { await readFile(file); fail("E_IMMUTABLE_EXISTS", `Refusing to overwrite immutable artifact: ${file}`); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const temporary = `${file}.${process.pid}.tmp`; await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o444 }); await rename(temporary, file);
}
export async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
export async function deployCandidate({ candidate, adapter, state, previewBaseUrl }) {
  const uploaded = await adapter.uploadVersion(candidate);
  const versionId = typeof uploaded === "string" ? uploaded : uploaded.versionId;
  const effectivePreviewUrl = typeof uploaded === "string" ? previewBaseUrl : uploaded.previewUrl || previewBaseUrl;
  if (!versionId) fail("E_VERSION_ID", "Cloudflare did not return an immutable Worker version ID.");
  try { await adapter.smokeTest({ versionId, candidate, previewBaseUrl: effectivePreviewUrl }); }
  catch (error) { await adapter.retireVersion?.(versionId); throw error; }
  return { ...state, candidates: { ...(state.candidates ?? {}), [candidate.candidateId]: { versionId, manifestSha256: candidate.manifestSha256, snapshot: candidate.submittedSnapshot, status: "verified" } } };
}
export async function promoteCandidate({ candidate, adapter, state }) {
  const record = state.candidates?.[candidate.candidateId];
  if (!record || record.status !== "verified" || record.manifestSha256 !== candidate.manifestSha256) fail("E_PROMOTION_GATE", "Only the exact smoke-tested candidate may be promoted.");
  await adapter.promoteVersion(record.versionId); // Cloudflare promotion is a single version-pointer operation.
  return { ...state, active: { candidateId: candidate.candidateId, versionId: record.versionId, manifestSha256: candidate.manifestSha256 }, history: [...(state.history ?? []), { candidateId: candidate.candidateId, versionId: record.versionId, manifestSha256: candidate.manifestSha256 }] };
}
export async function rollback({ versionId, adapter, state }) {
  const target = (state.history ?? []).find((entry) => entry.versionId === versionId);
  if (!target) fail("E_ROLLBACK_TARGET", "Rollback target is not a named, previously promoted version.");
  await adapter.promoteVersion(target.versionId);
  return { ...state, active: { candidateId: target.candidateId, versionId: target.versionId, manifestSha256: target.manifestSha256 }, history: [...(state.history ?? []), { ...target, rollback: true }] };
}
