#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { readJson } from "./content-model-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function listFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function validateSiteAssets(failures) {
  const manifest = await readJson(path.join(root, "docs", "rights", "site-assets.json"));
  const assetRoot = path.join(root, "public", "images");
  const publicFiles = new Set((await listFiles(assetRoot)).map((relative) => `public/images/${relative}`));
  if (manifest.schemaVersion !== 1) failures.push("site-assets registry must use schemaVersion 1");
  if (!Array.isArray(manifest.assets)) {
    failures.push("site-assets registry must contain an assets array");
    return 0;
  }

  const ids = new Set();
  const registeredPaths = new Set();
  for (const asset of manifest.assets) {
    const label = `site asset ${typeof asset?.id === "string" ? asset.id : "<unknown>"}`;
    if (!asset || typeof asset !== "object") {
      failures.push("site-assets registry contains a non-object record");
      continue;
    }
    if (typeof asset.id !== "string" || asset.id.length === 0) failures.push(`${label}: id is missing`);
    else if (ids.has(asset.id)) failures.push(`${label}: duplicate id`);
    else ids.add(asset.id);

    if (typeof asset.path !== "string" || !/^public\/images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(asset.path) || asset.path.includes("..")) {
      failures.push(`${label}: path must be a safe public/images path`);
      continue;
    }
    if (registeredPaths.has(asset.path)) failures.push(`${label}: duplicate path ${asset.path}`);
    registeredPaths.add(asset.path);
    if (!publicFiles.has(asset.path)) {
      failures.push(`${label}: registered file is missing (${asset.path})`);
      continue;
    }

    if (asset.license?.spdx !== "CC-BY-4.0" || asset.license?.url !== "https://creativecommons.org/licenses/by/4.0/") {
      failures.push(`${label}: original site artwork must declare CC-BY-4.0 with its canonical license URL`);
    }
    if (typeof asset.creator !== "string" || asset.creator.length === 0) failures.push(`${label}: creator is missing`);
    if (typeof asset.createdAt !== "string" || Number.isNaN(Date.parse(asset.createdAt))) failures.push(`${label}: createdAt is missing or invalid`);
    if (typeof asset.attribution !== "string" || asset.attribution.length === 0) failures.push(`${label}: attribution is missing`);
    if (typeof asset.provenance?.method !== "string" || asset.provenance.method.length === 0) failures.push(`${label}: provenance method is missing`);
    if (typeof asset.provenance?.thirdPartyVisualAsset !== "string" || asset.provenance.thirdPartyVisualAsset.length === 0) failures.push(`${label}: third-party visual-asset statement is missing`);
    if (typeof asset.provenance?.referenceNote !== "string" || asset.provenance.referenceNote.length === 0) failures.push(`${label}: reference note is missing`);

    const buffer = await readFile(path.join(root, asset.path));
    const checksum = createHash("sha256").update(buffer).digest("hex");
    if (asset.technical?.sha256 !== checksum) failures.push(`${label}: SHA-256 does not match ${asset.path}`);
    if (asset.technical?.bytes !== buffer.length) failures.push(`${label}: byte count does not match ${asset.path}`);
    const metadata = await sharp(buffer).metadata();
    if (asset.technical?.format !== metadata.format) failures.push(`${label}: format does not match ${asset.path}`);
    if (asset.technical?.width !== metadata.width || asset.technical?.height !== metadata.height) failures.push(`${label}: dimensions do not match ${asset.path}`);
  }

  for (const publicPath of publicFiles) {
    if (!registeredPaths.has(publicPath)) failures.push(`unregistered site image ${publicPath}`);
  }
  return manifest.assets.length;
}

async function main() {
  const policies = await readJson(path.join(root, "content", "policies", "licenses.json"));
  const registry = await readJson(path.join(root, "content", "rights", "registry.json"));
  const chapterRoot = path.join(root, "content", "chapters");
  const directories = (await readdir(chapterRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const failures = [];
  if (policies.prose.spdx !== "CC-BY-4.0") failures.push("prose policy must be CC-BY-4.0");
  if (policies.code.spdx !== "MIT") failures.push("code policy must be MIT");
  if (policies.originalMetadata.spdx !== "CC0-1.0") failures.push("original metadata policy must be CC0-1.0");
  const records = new Map(registry.records.map((record) => [record.id, record]));
  if (records.size !== registry.records.length) failures.push("rights registry contains duplicate IDs");
  const referenced = new Set();

  for (const directory of directories) {
    const [meta, rights] = await Promise.all([
      readJson(path.join(chapterRoot, directory, "meta.json")),
      readJson(path.join(chapterRoot, directory, "rights.json")),
    ]);
    if (meta.licenses.prose !== "CC-BY-4.0" || rights.proseLicense !== "CC-BY-4.0") failures.push(`${meta.id}: prose license mismatch`);
    if (meta.licenses.code !== "MIT") failures.push(`${meta.id}: code license mismatch`);
    if (meta.licenses.originalMetadata !== "CC0-1.0") failures.push(`${meta.id}: metadata license mismatch`);
    if (JSON.stringify(meta.rightsRecordIds) !== JSON.stringify(rights.rightsRecordIds)) failures.push(`${meta.id}: rights references disagree`);
    if (JSON.stringify(meta.licenses.thirdPartyExceptions) !== JSON.stringify(rights.thirdPartyExceptions)) failures.push(`${meta.id}: exception references disagree`);
    for (const id of rights.rightsRecordIds) {
      referenced.add(id);
      const record = records.get(id);
      if (!record) failures.push(`${meta.id}: missing rights record ${id}`);
      else if (record.chapterId !== meta.id) failures.push(`${meta.id}: rights record ${id} belongs to ${record.chapterId}`);
    }
    for (const id of rights.thirdPartyExceptions) {
      if (records.get(id)?.kind !== "license-exception") failures.push(`${meta.id}: ${id} is not a license-exception record`);
    }
  }

  for (const record of registry.records) {
    if (!referenced.has(record.id)) failures.push(`unreferenced rights record ${record.id}`);
  }
  const adaptation = records.get("adapt-cwi101-generative-ai");
  if (!adaptation || adaptation.kind !== "oer-adaptation" || adaptation.source.license !== "CC-BY-4.0") {
    failures.push("the CWI 101 adaptation record is missing or malformed");
  }
  const siteAssetCount = await validateSiteAssets(failures);
  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(`Rights validation passed: ${directories.length} chapters, ${registry.records.length} chapter-level record(s), ${siteAssetCount} site asset record(s), three distinct license domains.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
