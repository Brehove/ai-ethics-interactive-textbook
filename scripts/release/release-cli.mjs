import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import { cp, mkdtemp, readFile, symlink } from "node:fs/promises";
import {
  assembleReleaseSnapshot, deployCandidate, makeCandidate, materializeReleaseDocuments,
  promoteCandidate, readJson, rollback, verifyCandidate, writeJsonImmutable,
} from "./release.mjs";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const command = args.shift();
const value = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const required = (name) => value(name) ?? (() => { throw new Error(`${name} is required`); })();
const stateFile = () => value("--state") ?? path.join(root, ".release", "state.json");
const dryRun = () => args.includes("--dry-run") || process.env.RELEASE_EXECUTE !== "1";
const allowUnsigned = () => args.includes("--allow-unsigned") || process.env.RELEASE_ALLOW_UNSIGNED === "1";
const d1Documents = () => (value("--d1-documents") ?? "chapter_ch07").split(",").map((item) => item.trim()).filter(Boolean);

async function verifyForRelease(candidate) {
  const publicKey = process.env.RELEASE_PUBLIC_KEY
    || await readFile(path.join(root, "docs/baseline/origin-main-manifest.json.pub.pem"), "utf8");
  verifyCandidate(candidate, publicKey, { requireSignature: !allowUnsigned() });
}

const adapter = {
  uploadVersion: async (candidate) => {
    if (dryRun()) return `dry-run-${Date.now()}`;
    const { stdout } = await exec("npx", ["wrangler", "versions", "upload", "--name", "ethicsandai", "--assets", required("--built-assets"), "--tag", candidate.candidateId, "--message", `Immutable content candidate ${candidate.manifestSha256}`], { cwd: root });
    const version = stdout.match(/(?:Version ID|version)[^a-zA-Z0-9]*([a-f0-9-]{16,})/i);
    const preview = stdout.match(/https:\/\/[^\s]+workers\.dev[^\s]*/i);
    if (!version) throw new Error("Wrangler did not return an immutable version id");
    return { versionId: version[1], previewUrl: preview?.[0] };
  },
  promoteVersion: async (id) => { if (!dryRun()) await exec("npx", ["wrangler", "versions", "deploy", `${id}@100`, "--name", "ethicsandai", "--yes"], { cwd: root }); },
  retireVersion: async () => {},
  smokeTest: async ({ previewBaseUrl }) => {
    if (!dryRun() && !previewBaseUrl) throw new Error("Wrangler did not return the exact immutable version preview URL");
    if (previewBaseUrl) await exec("node", ["scripts/release/smoke.mjs", "--base-url", previewBaseUrl, "--candidate", required("--candidate"), "--asset-digests", required("--asset-digests")], { cwd: root });
  },
};

if (command === "candidate") {
  if (!process.env.RELEASE_SIGNING_KEY && !allowUnsigned()) throw new Error("RELEASE_SIGNING_KEY is required outside an explicit local unsigned self-test");
  const submittedSnapshot = await readJson(required("--snapshot"));
  const releaseSnapshot = assembleReleaseSnapshot({ submittedSnapshot, baselineSnapshot: await readJson(required("--baseline")), allowedD1DocumentIds: d1Documents() });
  const candidate = makeCandidate({ submittedSnapshot, releaseSnapshot, snapshotHash: required("--snapshot-hash"), snapshotRevision: required("--snapshot-revision"), commitSha: required("--commit-sha"), signingKey: process.env.RELEASE_SIGNING_KEY });
  await verifyForRelease(candidate);
  await writeJsonImmutable(required("--out"), candidate);
  console.log(candidate.manifestSha256);
} else if (command === "verify") {
  await verifyForRelease(await readJson(required("--candidate")));
  console.log("verified");
} else if (command === "gates") {
  const candidate = await readJson(required("--candidate"));
  await verifyForRelease(candidate);
  const workspace = await mkdtemp(path.join(os.tmpdir(), "ai-ethics-release-"));
  const materialized = await materializeReleaseDocuments({ sourceRoot: root, workspace, releaseSnapshot: candidate.releaseSnapshot, releaseAssetToken: process.env.RELEASE_ASSET_TOKEN });
  await symlink(path.join(root, "node_modules"), path.join(workspace, "node_modules"), "dir");
  for (const [bin, argv] of [["npm", ["run", "content:generate"]], ["npm", ["run", "validate"]], ["npm", ["run", "build"]]]) await exec(bin, argv, { cwd: workspace });
  const out = path.resolve(required("--out"));
  const dist = path.join(path.dirname(out), "dist");
  await cp(path.join(workspace, "dist"), dist, { recursive: true });
  await writeJsonImmutable(out, { materialized, dist, candidateManifestSha256: candidate.manifestSha256 });
} else if (command === "deploy") {
  const candidate = await readJson(required("--candidate"));
  await verifyForRelease(candidate);
  const previewBaseUrl = value("--preview-url");
  const next = await deployCandidate({ candidate, adapter, state: await readJson(stateFile()).catch(() => ({})), previewBaseUrl });
  await writeJsonImmutable(`${stateFile()}.${candidate.candidateId}.json`, next);
  console.log(JSON.stringify(next));
} else if (command === "promote") {
  if (dryRun()) throw new Error("Promotion requires RELEASE_EXECUTE=1 and protected environment approval.");
  const candidate = await readJson(required("--candidate"));
  await verifyForRelease(candidate);
  const next = await promoteCandidate({ candidate, adapter, state: await readJson(required("--state")) });
  await writeJsonImmutable(required("--out"), next);
  console.log(JSON.stringify(next.active));
} else if (command === "rollback") {
  if (dryRun()) throw new Error("Rollback requires RELEASE_EXECUTE=1.");
  const next = await rollback({ versionId: required("--version"), adapter, state: await readJson(required("--state")) });
  await writeJsonImmutable(required("--out"), next);
  console.log(JSON.stringify(next.active));
} else {
  throw new Error("usage: candidate|verify|gates|deploy|promote|rollback");
}
