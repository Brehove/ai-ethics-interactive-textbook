#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);
const args = process.argv.slice(2);
const command = args.shift();
const value = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const required = (name) => value(name) ?? (() => { throw new Error(`${name} is required`); })();
const stableJson = (item) => Array.isArray(item) ? `[${item.map(stableJson).join(",")}]` : item && typeof item === "object" ? `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${stableJson(item[key])}`).join(",")}}` : JSON.stringify(item);
const sha256 = (item) => createHash("sha256").update(Buffer.isBuffer(item) ? item : typeof item === "string" ? item : stableJson(item)).digest("hex");
const deterministicUuid = (purpose) => {
  const hex = sha256(`${purpose}:${runId}:${runAttempt}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const runId = process.env.GITHUB_RUN_ID;
const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
if (!/^\d{1,30}$/.test(runId ?? "") || !/^\d{1,10}$/.test(runAttempt)) throw new Error("GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT are required");

async function post(pathname, body) {
  const token = process.env.RELEASE_DEPLOY_RECEIPT_TOKEN;
  if (typeof token !== "string" || token.length < 32) throw new Error("RELEASE_DEPLOY_RECEIPT_TOKEN is required");
  const response = await fetch(`https://auth.ethicsandai.your-digital-life.org${pathname}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-github-run-id": runId },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Release control plane returned ${response.status}: ${text}`);
  return JSON.parse(text);
}

if (command === "stage") {
  const candidate = await readJson(required("--candidate"));
  const state = await readJson(required("--state"));
  const buildAttestation = await readFile(required("--build-attestation"));
  const record = state.candidates?.[candidate.candidateId];
  if (!record || record.status !== "verified" || record.manifestSha256 !== candidate.manifestSha256 || !record.versionId) throw new Error("Candidate state is not the exact smoke-tested immutable version");
  const expectedInput = required("--expected-active");
  const expectedActiveReleaseId = expectedInput === "none" ? null : expectedInput;
  const fallbackRollbackVersion = required("--fallback-rollback-version");
  const staged = await post("/v1/release-deployments:stage", {
    candidateId: candidate.candidateId,
    snapshotHash: candidate.submittedSnapshot.sha256,
    snapshotRevision: candidate.submittedSnapshot.revision,
    candidateManifestHash: candidate.manifestSha256,
    buildAttestationHash: sha256(buildAttestation),
    expectedActiveReleaseId,
    cloudflareVersionId: record.versionId,
    idempotencyKey: deterministicUuid("stage"),
  });
  if (staged.previousCloudflareVersionId && staged.previousCloudflareVersionId !== fallbackRollbackVersion) throw new Error("Configured emergency rollback version does not match the active release receipt");
  const output = { ...staged, emergencyRollbackVersionId: staged.previousCloudflareVersionId || fallbackRollbackVersion };
  await writeFile(required("--out"), `${JSON.stringify(output, null, 2)}\n`, { flag: "wx", mode: 0o444 });
  console.log(JSON.stringify(output));
} else if (command === "receipt") {
  const transaction = await readJson(required("--transaction"));
  const verification = await readFile(required("--verification"));
  const cloudflareDeploymentId = `cfdeploy_${runId}_${runAttempt}`;
  const verificationHash = sha256(verification);
  const payload = {
    transactionId: transaction.transactionId, action: transaction.action, releaseId: transaction.releaseId,
    previousActiveReleaseId: transaction.expectedActiveReleaseId ?? null, candidateId: transaction.candidateId ?? null,
    snapshotHash: transaction.snapshotHash ?? null, snapshotRevision: transaction.snapshotRevision ?? null,
    candidateManifestHash: transaction.candidateManifestHash, buildAttestationHash: transaction.buildAttestationHash,
    cloudflareDeploymentId, cloudflareVersionId: transaction.cloudflareVersionId, verificationHash,
  };
  const receipt = await post(`/v1/release-deployments/${encodeURIComponent(transaction.transactionId)}:recordReceipt`, {
    candidateManifestHash: transaction.candidateManifestHash,
    buildAttestationHash: transaction.buildAttestationHash,
    cloudflareDeploymentId,
    cloudflareVersionId: transaction.cloudflareVersionId,
    verificationHash,
    receiptHash: sha256(payload),
    idempotencyKey: deterministicUuid("receipt"),
  });
  await writeFile(required("--out"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o444 });
  console.log(JSON.stringify(receipt));
} else if (command === "emergency-rollback") {
  const transaction = await readJson(required("--transaction"));
  const versionId = transaction.emergencyRollbackVersionId;
  if (typeof versionId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(versionId)) throw new Error("A validated emergency rollback version is required");
  await exec("npx", ["wrangler", "versions", "deploy", `${versionId}@100`, "--name", "ethicsandai", "--yes"]);
  console.log(JSON.stringify({ rolledBackTo: versionId, transactionId: transaction.transactionId }));
} else {
  throw new Error("usage: stage|receipt|emergency-rollback");
}
