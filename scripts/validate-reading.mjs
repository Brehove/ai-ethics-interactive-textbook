#!/usr/bin/env node

import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReadingArtifacts, normalizeNewlines, readJson } from "./content-model-lib.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chaptersRoot = path.join(projectRoot, "content", "chapters");

async function main() {
  const directories = (await readdir(chaptersRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(chaptersRoot, entry.name))
    .sort();
  const failures = [];
  let segments = 0;
  let words = 0;
  for (const directory of directories) {
    try {
      const [markdown, meta, reading, plainText, readingStat, textStat] = await Promise.all([
        readFile(path.join(directory, "chapter.md"), "utf8"),
        readJson(path.join(directory, "meta.json")),
        readJson(path.join(directory, "reading.json")),
        readFile(path.join(directory, "reading.txt"), "utf8"),
        lstat(path.join(directory, "reading.json")),
        lstat(path.join(directory, "reading.txt")),
      ]);
      if (readingStat.isSymbolicLink() || textStat.isSymbolicLink()) throw new Error("generated reading artifact is a symlink");
      const generated = buildReadingArtifacts(markdown, meta);
      if (`${JSON.stringify(reading, null, 2)}\n` !== `${JSON.stringify(generated.reading, null, 2)}\n`) {
        throw new Error("reading.json is stale");
      }
      if (normalizeNewlines(plainText) !== generated.plainText) throw new Error("reading.txt is stale");
      if (meta.wordCount !== reading.wordCount || meta.readingMinutes !== reading.readingMinutes) {
        throw new Error("meta.json reading metrics are stale");
      }
      if (reading.audio.provider !== null || reading.audio.generated !== false || reading.audio.streamingReady !== true) {
        throw new Error("audio boundary must remain provider-neutral, ungenerated, and streaming-ready");
      }
      const ids = reading.segments.map((segment) => segment.id);
      if (new Set(ids).size !== ids.length) throw new Error("reading segment IDs are not unique");
      const sectionIds = new Set(reading.segments.filter((segment) => segment.type === "heading").map((segment) => segment.id));
      for (const segment of reading.segments) {
        if (segment.sectionId && !sectionIds.has(segment.sectionId)) throw new Error(`${segment.id} points to missing section ${segment.sectionId}`);
      }
      segments += reading.segments.length;
      words += reading.wordCount;
    } catch (error) {
      failures.push(`${path.basename(directory)}: ${error.message}`);
    }
  }
  if (directories.length !== 18) failures.push(`expected 18 chapter directories, found ${directories.length}`);
  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(`Reading validation passed: ${directories.length} chapters, ${segments} stable segments, ${words} words.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
