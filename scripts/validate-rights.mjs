#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./content-model-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(`Rights validation passed: ${directories.length} chapters, ${registry.records.length} item-level record(s), three distinct license domains.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
