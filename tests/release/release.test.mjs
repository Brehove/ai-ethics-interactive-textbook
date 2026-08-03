import test from "node:test"; import assert from "node:assert/strict"; import { generateKeyPairSync } from "node:crypto";
import { mkdtemp } from "node:fs/promises"; import { tmpdir } from "node:os"; import path from "node:path";
import { makeCandidate, verifyCandidate, deployCandidate, promoteCandidate, rollback, sha256, assembleReleaseSnapshot, materializeReleaseAssets } from "../../scripts/release/release.mjs";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const snapshot = () => ({ schemaVersion: 2, authorityRegistry: { chapter_ch07: { authority: "d1" } }, chapters: [] });
const candidate = () => { const s = snapshot(); return makeCandidate({ snapshot: s, snapshotHash: sha256(s), snapshotRevision: "revision_submitted_7", commitSha: "a".repeat(40), signingKey: privateKey, createdAt: "2026-08-03T00:00:00.000Z" }); };
test("rejects stale submitted snapshot and hash mismatch", () => { const c = candidate(); c.submittedSnapshot.value.chapters.push({ changed: true }); assert.throws(() => verifyCandidate(c, publicKey), { code: "E_MANIFEST_HASH_MISMATCH" }); assert.throws(() => makeCandidate({ snapshot: snapshot(), snapshotHash: "0".repeat(64), snapshotRevision: "revision_submitted_7", commitSha: "a".repeat(40) }), { code: "E_SNAPSHOT_HASH_MISMATCH" }); });
test("assembly changes only Chapter 7 and preserves the exact submitted document", () => { const content = { chapterId: "chapter_ch07", revisionId: "revision_final", chapterVersion: "revision_final", status: "published" }; const submittedContentHash = sha256(content); const submitted = { documents: [{ documentId: "chapter_ch07", submittedContentHash, revisionId: "revision_final", content }] }; const baseline = { chapters: [{ chapterId: "chapter_ch07", revisionId: "revision_old" }, { chapterId: "chapter_other" }], authorityRegistry: { chapter_ch07: { authority: "git" }, chapter_other: { authority: "git" } }, contentObjects: {} }; const release = assembleReleaseSnapshot({ submittedSnapshot: submitted, baselineSnapshot: baseline }); assert.strictEqual(release.chapters[0], content); assert.equal(release.chapters[1].chapterId, "chapter_other"); assert.equal(release.authorityRegistry.chapter_ch07.authority, "d1"); assert.equal(release.authorityRegistry.chapter_ch07.normalizedSnapshotHash, submittedContentHash); });
test("assembly rejects any submitted-content mutation or revision mismatch", () => { const content = { chapterId: "chapter_ch07", revisionId: "revision_final", chapterVersion: "revision_final", status: "published" }; const baseline = { chapters: [{ chapterId: "chapter_ch07" }], authorityRegistry: {}, contentObjects: {} }; assert.throws(() => assembleReleaseSnapshot({ submittedSnapshot: { documents: [{ documentId: "chapter_ch07", submittedContentHash: "0".repeat(64), revisionId: "revision_final", content }] }, baselineSnapshot: baseline }), { code: "E_SUBMITTED_CONTENT_HASH" }); assert.throws(() => assembleReleaseSnapshot({ submittedSnapshot: { documents: [{ documentId: "chapter_ch07", submittedContentHash: sha256(content), revisionId: "revision_other", content }] }, baselineSnapshot: baseline }), { code: "E_SUBMITTED_FINALIZATION" }); });
test("failed smoke test leaves active release untouched", async () => { const c = candidate(); const state = { active: { versionId: "v-old" } }; await assert.rejects(() => deployCandidate({ candidate: c, state, adapter: { uploadVersion: async () => "v-new", smokeTest: async () => { throw new Error("CSP failed"); }, retireVersion: async () => {} } })); assert.deepEqual(state.active, { versionId: "v-old" }); });
test("promotion and rollback select exact prior version", async () => { const c = candidate(); const promoted = await promoteCandidate({ candidate: c, state: { candidates: { [c.candidateId]: { versionId: "v-17", manifestSha256: c.manifestSha256, status: "verified" } }, history: [{ candidateId: "old", versionId: "v-16", manifestSha256: "a".repeat(64) }] }, adapter: { promoteVersion: async () => {} } }); const calls = []; const rolled = await rollback({ versionId: "v-16", state: promoted, adapter: { promoteVersion: async (v) => calls.push(v) } }); assert.equal(rolled.active.versionId, "v-16"); assert.deepEqual(calls, ["v-16"]); });
test("media assets use only the fixed hash route and fail closed on status, size, or hash", async () => {
  const bytes = Buffer.from("asset"); const digest = sha256(bytes);
  const asset = { sha256: digest, bytes: bytes.length, mimeType: "image/png", mediaVersionId: "mediaVersion_x", role: "display", downloadPath: `/v1/release-assets/${digest}` };
  const projection = { assets: [asset], versions: [{ mediaVersionId: "mediaVersion_x" }] };
  const temp = await mkdtemp(path.join(tmpdir(), "release-assets-test-")); let requested;
  const good = async (url, options) => { requested = { url, options }; return new Response(bytes, { headers: { "content-type": "image/png" } }); };
  const result = await materializeReleaseAssets({ projection, publicDir: temp, token: "secret", fetcher: good });
  assert.equal(requested.url, `https://auth.ethicsandai.your-digital-life.org/v1/release-assets/${digest}`);
  assert.equal(requested.options.headers.authorization, "Bearer secret");
  assert.equal(result[0].publicPath, `/release-assets/${digest}.png`);
  const statusDir = await mkdtemp(path.join(tmpdir(), "release-assets-test-"));
  const sizeDir = await mkdtemp(path.join(tmpdir(), "release-assets-test-"));
  const hashDir = await mkdtemp(path.join(tmpdir(), "release-assets-test-"));
  await assert.rejects(() => materializeReleaseAssets({ projection, publicDir: statusDir, token: "t", fetcher: async () => new Response("x", { status: 404 }) }), { code: "E_RELEASE_ASSET_STATUS" });
  await assert.rejects(() => materializeReleaseAssets({ projection: { ...projection, assets: [{ ...asset, bytes: 99 }] }, publicDir: sizeDir, token: "t", fetcher: good }), { code: "E_RELEASE_ASSET_SIZE" });
  const wrong = "0".repeat(64); const wrongAsset = { ...asset, sha256: wrong, downloadPath: `/v1/release-assets/${wrong}` };
  await assert.rejects(() => materializeReleaseAssets({ projection: { ...projection, assets: [wrongAsset] }, publicDir: hashDir, token: "t", fetcher: good }), { code: "E_RELEASE_ASSET_HASH" });
});
test("release materialization preserves WAV, WebM, and plain-text extensions", async () => {
  for (const [mimeType, extension] of [["audio/wav", "wav"], ["video/webm", "webm"], ["text/plain", "txt"]]) {
    const bytes = Buffer.from(`asset-${extension}`); const digest = sha256(bytes);
    const projection = { assets: [{ sha256: digest, bytes: bytes.length, mimeType, mediaVersionId: `mediaVersion_${extension}`, role: "derivative", downloadPath: `/v1/release-assets/${digest}` }], versions: [{ mediaVersionId: `mediaVersion_${extension}` }] };
    const directory = await mkdtemp(path.join(tmpdir(), "release-native-types-"));
    const result = await materializeReleaseAssets({ projection, publicDir: directory, token: "secret", fetcher: async () => new Response(bytes, { headers: { "content-type": mimeType } }) });
    assert.equal(result[0].publicPath, `/release-assets/${digest}.${extension}`);
  }
});
