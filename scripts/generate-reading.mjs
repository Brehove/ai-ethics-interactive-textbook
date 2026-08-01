#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  buildReadingArtifacts,
  normalizeNewlines,
  readJson,
  sha256,
  synchronizeIdentityMarkers,
  writeJson,
  writeText,
} from "./content-model-lib.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chaptersRoot = path.join(projectRoot, "content", "chapters");

function argumentsFrom(argv) {
  const options = { all: false, chapter: null, write: false, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--all") options.all = true;
    else if (argument === "--chapter") options.chapter = argv[++index];
    else if (argument === "--write") options.write = true;
    else if (argument === "--check") options.check = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.all === Boolean(options.chapter)) throw new Error("Choose exactly one target: --all or --chapter <slug|directory>");
  if (options.write === options.check) throw new Error("Choose exactly one mode: --write or --check");
  return options;
}

async function chapterDirectories(options) {
  const names = (await readdir(chaptersRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (options.all) return names.map((name) => path.join(chaptersRoot, name));
  const match = names.find((name) => name === options.chapter || name.replace(/^\d+-/, "") === options.chapter);
  if (!match) throw new Error(`Unknown chapter: ${options.chapter}`);
  return [path.join(chaptersRoot, match)];
}

async function processChapter(directory, options) {
  const markdownPath = path.join(directory, "chapter.md");
  const metaPath = path.join(directory, "meta.json");
  const readingPath = path.join(directory, "reading.json");
  const plainTextPath = path.join(directory, "reading.txt");
  const [markdownSource, meta, currentReading, currentPlainText] = await Promise.all([
    readFile(markdownPath, "utf8"),
    readJson(metaPath),
    readJson(readingPath),
    readFile(plainTextPath, "utf8"),
  ]);
  const markdown = synchronizeIdentityMarkers(markdownSource, meta.id);
  const artifacts = buildReadingArtifacts(markdown, meta);
  const nextMeta = {
    ...meta,
    description: artifacts.description,
    wordCount: artifacts.reading.wordCount,
    readingMinutes: artifacts.reading.readingMinutes,
    websiteBaseline: { ...meta.websiteBaseline, canonicalMarkdownSha256: sha256(markdown) },
  };

  const differences = [];
  if (normalizeNewlines(markdownSource) !== markdown) differences.push("chapter.md identity markers");
  if (`${JSON.stringify(currentReading, null, 2)}\n` !== `${JSON.stringify(artifacts.reading, null, 2)}\n`) differences.push("reading.json");
  if (normalizeNewlines(currentPlainText) !== artifacts.plainText) differences.push("reading.txt");
  if (`${JSON.stringify(meta, null, 2)}\n` !== `${JSON.stringify(nextMeta, null, 2)}\n`) differences.push("meta.json");

  if (options.check && differences.length) throw new Error(`${meta.id}: stale ${differences.join(", ")}`);
  if (options.write && differences.length) {
    await writeText(markdownPath, markdown);
    await writeJson(readingPath, artifacts.reading);
    await writeText(plainTextPath, artifacts.plainText);
    await writeJson(metaPath, nextMeta);
  }
  return { id: meta.id, differences };
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  const directories = await chapterDirectories(options);
  const results = [];
  for (const directory of directories) results.push(await processChapter(directory, options));
  const changed = results.filter((result) => result.differences.length);
  if (options.check) process.stdout.write(`Reading check passed for ${results.length} chapter(s).\n`);
  else process.stdout.write(`Regenerated ${changed.length} of ${results.length} chapter(s).\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
