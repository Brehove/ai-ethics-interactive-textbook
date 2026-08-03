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
const SAFE_MIME = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"], ["image/gif", "gif"], ["audio/mpeg", "mp3"], ["audio/wav", "wav"], ["audio/mp4", "m4a"], ["video/mp4", "mp4"], ["video/webm", "webm"], ["application/pdf", "pdf"], ["text/plain", "txt"]]);
export async function materializeReleaseAssets({ projection, publicDir, token, fetcher = fetch }) {
  if (!token) fail("E_RELEASE_ASSET_TOKEN", "RELEASE_ASSET_TOKEN is required for content-addressed media materialization.");
  if (!projection || !Array.isArray(projection.assets) || !Array.isArray(projection.versions)) fail("E_MEDIA_PROJECTION", "Submitted snapshot must include mediaProjection assets and versions.");
  if (projection.assets.length > 256 || projection.assets.reduce((sum, asset) => sum + (Number.isInteger(asset?.bytes) ? asset.bytes : 0), 0) > 256 * 1024 * 1024) fail("E_MEDIA_PROJECTION", "Submitted media projection exceeds release limits.");
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
function normalizedAuthorityIds(ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 18 || ids.some((id) => !/^chapter_ch(?:0[1-9]|1[0-8])$/.test(id)) || new Set(ids).size !== ids.length) fail("E_AUTHORITY_POLICY", "The release authority policy must contain 1 to 18 unique canonical chapter IDs.");
  return [...ids].sort();
}
export function assertAuthorityPolicy(snapshot, allowedD1DocumentIds) {
  const expected = normalizedAuthorityIds(allowedD1DocumentIds);
  const actual = Object.entries(snapshot.authorityRegistry ?? {}).filter(([, source]) => source.authority === "d1").map(([id]) => id).sort();
  if (stableJson(actual) !== stableJson(expected)) fail("E_AUTHORITY_POLICY", "The signed release authority set does not exactly match the D1-authoritative chapters in the release snapshot.");
}
export function assertCanary(snapshot) { assertAuthorityPolicy(snapshot, [CANARY_D1_DOCUMENT]); }
/** Bind every submitted D1 document into an otherwise Git-authoritative full-book snapshot. */
export function assembleReleaseSnapshot({ submittedSnapshot, baselineSnapshot, allowedD1DocumentIds = [CANARY_D1_DOCUMENT] }) {
  const allowed = normalizedAuthorityIds(allowedD1DocumentIds);
  const documents = submittedSnapshot?.documents;
  if (!Array.isArray(documents) || documents.length !== allowed.length || new Set(documents.map((item) => item?.documentId)).size !== documents.length || stableJson(documents.map((item) => item.documentId).sort()) !== stableJson(allowed)) fail("E_SUBMITTED_SCOPE", "The submitted snapshot must contain exactly the complete signed D1 authority set.");
  if (!Array.isArray(baselineSnapshot?.chapters) || baselineSnapshot.chapters.length !== 18) fail("E_BASELINE_SCOPE", "The Git baseline must contain the complete 18-chapter book.");
  const baselineIds = new Set(baselineSnapshot.chapters.map((chapter) => chapter.chapterId));
  const replacements = new Map();
  const authorityRegistry = { ...baselineSnapshot.authorityRegistry };
  const contentObjects = { ...baselineSnapshot.contentObjects };
  for (const document of documents) {
    if (!document?.content || document.content.chapterId !== document.documentId || !baselineIds.has(document.documentId)) fail("E_SUBMITTED_SCOPE", `Submitted document ${document?.documentId || "unknown"} is not a canonical chapter in the Git baseline.`);
    const finalizedChapter = document.content;
    const finalizedHash = sha256(finalizedChapter);
    if (!/^[a-f0-9]{64}$/i.test(document.submittedContentHash ?? "") || finalizedHash !== document.submittedContentHash) fail("E_SUBMITTED_CONTENT_HASH", `Submitted ${document.documentId} bytes do not match the immutable submitted content hash.`);
    if (document.revisionId !== finalizedChapter.revisionId || finalizedChapter.chapterVersion !== document.revisionId || finalizedChapter.status !== "published") fail("E_SUBMITTED_FINALIZATION", `Submitted ${document.documentId} was not server-finalized into the declared publishable revision.`);
    const sourcePath = baselineSnapshot.authorityRegistry?.[document.documentId]?.sourcePath;
    if (typeof sourcePath !== "string" || !/^content\/chapters\/[A-Za-z0-9._/-]+\/$/.test(sourcePath) || sourcePath.includes("..")) fail("E_MATERIALIZATION_PATH", `No safe Git source path exists for ${document.documentId}.`);
    replacements.set(document.documentId, finalizedChapter);
    authorityRegistry[document.documentId] = { authority: "d1", documentId: document.documentId, domainRevisionId: finalizedChapter.revisionId, normalizedSnapshotHash: finalizedHash };
    contentObjects[document.documentId] = { type: "chapter", domainRevisionId: finalizedChapter.revisionId, sha256: finalizedHash };
  }
  const chapters = baselineSnapshot.chapters.map((chapter) => replacements.get(chapter.chapterId) || chapter);
  const releaseSnapshot = { ...baselineSnapshot, chapters, authorityRegistry, contentObjects, ...(submittedSnapshot.mediaProjection ? { mediaProjection: submittedSnapshot.mediaProjection } : {}) };
  assertAuthorityPolicy(releaseSnapshot, allowed);
  return releaseSnapshot;
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
async function materializeChapter({ workspace, releaseSnapshot, chapter, materializationPath, materializedAssets }) {
  const dir = path.resolve(workspace, materializationPath);
  const chapterRoot = `${path.resolve(workspace, "content/chapters")}${path.sep}`;
  if (!dir.startsWith(chapterRoot)) fail("E_MATERIALIZATION_PATH", `Materialization path escaped the chapter root for ${chapter.chapterId}.`);
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
  const placements = chapter.body.filter((block) => ["externalEmbed", "richLink", "mediaFigure"].includes(block.type)).map((block) => {
    if (block.type === "mediaFigure") {
      const version = releaseSnapshot.mediaProjection?.versions?.find((item) => item.mediaVersionId === block.mediaVersionId);
      if (!version || version.rights?.rightsCaseId !== block.rightsCaseId || version.rights?.status !== "cleared") fail("E_MEDIA_RIGHTS", `Media figure ${block.figureId} lacks an exact cleared projected media version.`);
      const versionAssets = materializedAssets.filter((item) => item.mediaVersionId === block.mediaVersionId);
      const primary = versionAssets.find((item) => item.role === "derivative");
      if (!primary) fail("E_MEDIA_NOT_MATERIALIZED", `Media figure ${block.figureId} lacks an exact projected media version.`);
      const poster = versionAssets.find((item) => item.role === "poster");
      const detectedMime = primary.mimeType;
      const kind = version.kind ?? (detectedMime.startsWith("image/") ? (poster ? "gif" : "image") : detectedMime.startsWith("audio/") ? "audio" : detectedMime.startsWith("video/") ? "video" : detectedMime === "application/pdf" ? "pdf" : detectedMime === "text/plain" ? "document" : null);
      if (!kind) fail("E_MEDIA_PROJECTION", `Media figure ${block.figureId} has no supported release kind.`);
      const responsive = versionAssets.filter((item) => /^responsive-(?:640|1280|1920)$/.test(item.role)).map((item) => ({ src: item.publicPath, width: Number(item.role.slice("responsive-".length)) })).sort((a, b) => a.width - b.width);
      return { type: block.type, blockId: block.blockId, anchorPassageId: block.anchorPassageId, figureId: block.figureId, mediaId: block.mediaId, mediaVersionId: block.mediaVersionId, rightsCaseId: block.rightsCaseId, kind, src: primary.publicPath, ...(responsive.length ? { srcset: responsive } : {}), ...(poster ? { poster: poster.publicPath } : {}), title: version.title, downloadName: `${version.title || block.figureId}.${SAFE_MIME.get(primary.mimeType)}`.replace(/[^A-Za-z0-9._-]+/g, "-"), alt: block.alt, caption: block.caption, captionOmissionReason: block.captionOmissionReason, teachingUse: block.teachingUse, credit: block.creditOverride ?? version.rights?.credit ?? "Source and rights recorded in this release.", transcript: version.transcriptEquivalent?.text ?? version.technical?.transcriptEquivalent?.text, mimeType: detectedMime, bytes: primary.bytes, canonicalSource: `${RELEASE_ASSET_ORIGIN}/v1/release-assets/${primary.sha256}`, downloadable: block.downloadable, printPolicy: block.printPolicy, displayPreset: block.displayPreset, align: block.align };
    }
    return { type: block.type, blockId: block.blockId, anchorPassageId: block.anchorPassageId, ...(block.type === "externalEmbed" ? { identity: block.identity, canonicalUrl: block.canonicalUrl, caption: block.caption, teachingUse: block.teachingUse, fallback: block.fallback, adapterVersion: block.adapterVersion } : {}), ...(block.type === "richLink" ? { canonicalUrl: block.canonicalUrl, title: block.title, summary: block.summary, linkLabel: block.linkLabel, teachingUse: block.teachingUse } : {}) };
  });
  const sidecar = path.join(dir, "release-placements.json"); await writeFile(sidecar, `${JSON.stringify({ schemaVersion: 1, chapterId: chapter.chapterId, placements }, null, 2)}\n`);
  return { documentId: chapter.chapterId, materializationPath, chapterPath: path.join(dir, "chapter.md"), readingRecordPath: path.join(dir, "reading-record.json"), placementsPath: sidecar, chapterDigest: sha256(await readFile(path.join(dir, "chapter.md"))), readingRecordDigest: sha256(await readFile(path.join(dir, "reading-record.json"))), placementsDigest: sha256(await readFile(sidecar)) };
}
export async function materializeReleaseDocuments({ sourceRoot, workspace, releaseSnapshot, releaseAssetToken, fetcher }) {
  await cp(sourceRoot, workspace, { recursive: true, filter: (entry) => {
    const first = path.relative(sourceRoot, entry).split(path.sep)[0];
    return !["node_modules", ".git", "dist", "artifacts", ".wrangler"].includes(first);
  } });
  const d1Entries = Object.entries(releaseSnapshot.authorityRegistry ?? {}).filter(([, source]) => source.authority === "d1").sort(([a], [b]) => a.localeCompare(b));
  if (!d1Entries.length) fail("E_AUTHORITY_POLICY", "A database-authored release must contain at least one D1-authoritative chapter.");
  const book = JSON.parse(await readFile(path.join(workspace, "content/book.json"), "utf8"));
  const sourcePaths = new Map((book.parts ?? []).flatMap((part) => part.chapters ?? []).map((item) => [`chapter_${item.id}`, `content/chapters/${String(item.order).padStart(2, "0")}-${item.slug}/`]));
  const materializedAssets = releaseSnapshot.mediaProjection ? await materializeReleaseAssets({ projection: releaseSnapshot.mediaProjection, publicDir: path.join(workspace, "public/release-assets"), token: releaseAssetToken, fetcher }) : [];
  const chapters = [];
  for (const [documentId] of d1Entries) {
    const chapter = releaseSnapshot.chapters.find((item) => item.chapterId === documentId);
    if (!chapter) fail("E_SUBMITTED_SCOPE", `Release snapshot has no chapter content for ${documentId}.`);
    const materializationPath = sourcePaths.get(documentId);
    if (!materializationPath) fail("E_MATERIALIZATION_PATH", `The protected book manifest has no source path for ${documentId}.`);
    chapters.push(await materializeChapter({ workspace, releaseSnapshot, chapter, materializationPath, materializedAssets }));
  }
  return { documentCount: chapters.length, documents: chapters, assetCount: materializedAssets.length };
}
export async function materializeChapterSeven(options) {
  assertCanary(options.releaseSnapshot);
  const materialized = await materializeReleaseDocuments(options);
  return materialized.documents[0];
}
export function makeCandidate({ snapshot, submittedSnapshot = snapshot, releaseSnapshot = snapshot, snapshotHash, snapshotRevision, commitSha, createdAt = new Date().toISOString(), signingKey }) {
  if (!/^[a-f0-9]{64}$/i.test(snapshotHash)) fail("E_SNAPSHOT_HASH", "snapshotHash must be a SHA-256 hex digest.");
  if (!snapshotRevision || typeof snapshotRevision !== "string") fail("E_SNAPSHOT_REVISION", "snapshotRevision is required.");
  const actual = sha256(submittedSnapshot);
  if (actual !== snapshotHash) fail("E_SNAPSHOT_HASH_MISMATCH", "Submitted snapshot bytes do not match the requested immutable snapshot hash.");
  const d1AuthoritativeDocuments = Object.entries(releaseSnapshot.authorityRegistry ?? {}).filter(([, value]) => value.authority === "d1").map(([id]) => id).sort();
  assertAuthorityPolicy(releaseSnapshot, d1AuthoritativeDocuments);
  const unsigned = { schemaVersion: 2, candidateId: `candidate_${snapshotHash.slice(0, 24)}`, createdAt, submittedSnapshot: { sha256: snapshotHash, revision: snapshotRevision, bytes: Buffer.byteLength(stableJson(submittedSnapshot)), value: submittedSnapshot }, releaseSnapshot, code: { commitSha }, authorityPolicy: { d1AuthoritativeDocuments } };
  const manifestSha256 = sha256(unsigned);
  const signature = signingKey ? sign(null, Buffer.from(manifestSha256), signingKey).toString("base64") : null;
  return { ...unsigned, manifestSha256, signature, signatureAlgorithm: signature ? "ed25519" : null };
}
export function verifyCandidate(candidate, publicKey, { requireSignature = true } = {}) {
  const { manifestSha256, signature, signatureAlgorithm, ...unsigned } = candidate;
  if (sha256(unsigned) !== manifestSha256) fail("E_MANIFEST_HASH_MISMATCH", "Candidate manifest has been modified.");
  if (sha256(candidate.submittedSnapshot.value) !== candidate.submittedSnapshot.sha256) fail("E_STALE_SNAPSHOT", "Candidate no longer contains its submitted snapshot.");
  assertAuthorityPolicy(candidate.releaseSnapshot, candidate.authorityPolicy?.d1AuthoritativeDocuments);
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
