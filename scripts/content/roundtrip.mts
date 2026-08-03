import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitContentRepository } from "../../packages/content-repository/src/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");
const repository = new GitContentRepository(root);
const first = await repository.exportSnapshot(); const second = await repository.exportSnapshot();
assert.equal(first.sha256, second.sha256, "Git snapshot export must be deterministic");
assert.equal(first.canonicalJson, second.canonicalJson, "Canonical snapshot JSON must be stable");
assert.equal(first.report.chapterCount, 18); assert.equal(first.report.sectionCount, 268); assert.equal(first.report.passageCount, 1939);
process.stdout.write(`${JSON.stringify({ sha256: first.sha256, report: first.report }, null, 2)}\n`);
