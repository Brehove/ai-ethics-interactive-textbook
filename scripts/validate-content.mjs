#!/usr/bin/env node

import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractLeadingTitle,
  normalizeNewlines,
  parseInstrumentedMarkdown,
  readJson,
  sha256,
} from "./content-model-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(root, "content");
const chaptersRoot = path.join(contentRoot, "chapters");
const requiredChapterFiles = [
  "chapter.md",
  "meta.json",
  "annotations.json",
  "source-links.json",
  "world.json",
  "rights.json",
  "reading.json",
  "reading.txt",
];

function occurrences(source, expression) {
  return [...source.matchAll(expression)].length;
}

async function main() {
  const [map, book, baseline] = await Promise.all([
    readJson(path.join(contentRoot, "reconciliation-map.json")),
    readJson(path.join(contentRoot, "book.json")),
    readJson(path.join(contentRoot, "migration-baseline.json")),
  ]);
  const directories = (await readdir(chaptersRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const failures = [];
  const totals = { asides: 0, tables: 0, explicitIds: 0, ariaLabelledby: 0, markdownTables: 0, sections: 0, passages: 0 };
  const mapByOrder = new Map(map.chapters.map((chapter) => [chapter.order, chapter]));

  if (map.chapters.length !== 18 || directories.length !== 18 || book.chapterCount !== 18) {
    failures.push(`chapter count mismatch: map=${map.chapters.length}, directories=${directories.length}, book=${book.chapterCount}`);
  }
  if (book.privacy.studentAccounts !== false || book.privacy.studentDataStored !== false) failures.push("book privacy boundary must explicitly store no student data");
  if (book.parts.length !== 6) failures.push(`expected six Parts, found ${book.parts.length}`);
  const bookChapterIds = book.parts.flatMap((part) => part.chapters).sort((a, b) => a.order - b.order).map((chapter) => chapter.id);
  if (new Set(bookChapterIds).size !== 18) failures.push("book.json chapter references are missing or duplicated");

  for (const expected of map.chapters) {
    const expectedDirectory = `${String(expected.order).padStart(2, "0")}-${expected.slug}`;
    if (!directories.includes(expectedDirectory)) {
      failures.push(`${expected.id}: missing directory ${expectedDirectory}`);
      continue;
    }
    const directory = path.join(chaptersRoot, expectedDirectory);
    for (const fileName of requiredChapterFiles) {
      try {
        const stat = await lstat(path.join(directory, fileName));
        if (!stat.isFile() || stat.isSymbolicLink()) failures.push(`${expectedDirectory}/${fileName}: must be a materialized regular file`);
      } catch (error) {
        failures.push(`${expectedDirectory}/${fileName}: ${error.code ?? error.message}`);
      }
    }

    try {
      const [markdown, meta, annotations, sources, world, rights, reading] = await Promise.all([
        readFile(path.join(directory, "chapter.md"), "utf8"),
        readJson(path.join(directory, "meta.json")),
        readJson(path.join(directory, "annotations.json")),
        readJson(path.join(directory, "source-links.json")),
        readJson(path.join(directory, "world.json")),
        readJson(path.join(directory, "rights.json")),
        readJson(path.join(directory, "reading.json")),
      ]);
      if (extractLeadingTitle(markdown) !== expected.title || meta.title !== expected.title || reading.title !== expected.title) failures.push(`${expected.id}: approved title mismatch`);
      if (meta.id !== expected.id || meta.slug !== expected.slug || meta.order !== expected.order) failures.push(`${expected.id}: identity/order metadata mismatch`);
      if (meta.part.id !== expected.part.id || meta.part.order !== expected.part.order || meta.part.chapterOrder !== expected.part.chapterOrder) failures.push(`${expected.id}: Part metadata mismatch`);
      if (meta.path !== `/chapter/${expected.slug}/`) failures.push(`${expected.id}: route path mismatch`);
      if (meta.status !== "website-canonical") failures.push(`${expected.id}: status must be website-canonical`);
      if (meta.websiteBaseline.selectedSourceSha256 !== expected.selectedSourceSha256) failures.push(`${expected.id}: selected source lineage mismatch`);
      if (meta.websiteBaseline.canonicalMarkdownSha256 !== sha256(normalizeNewlines(markdown))) failures.push(`${expected.id}: canonical Markdown hash is stale`);
      for (const sidecar of [annotations, sources, world, rights, reading]) {
        if (sidecar.chapterId !== expected.id) failures.push(`${expected.id}: sidecar chapterId mismatch`);
      }
      const parsed = parseInstrumentedMarkdown(markdown, expected.id);
      if (parsed.title !== expected.title) failures.push(`${expected.id}: instrumented title mismatch`);
      if (reading.sourceSha256 !== sha256(normalizeNewlines(markdown))) failures.push(`${expected.id}: reading source hash mismatch`);
      const segmentIds = new Set(reading.segments.map((segment) => segment.id));
      for (const annotation of annotations.items) {
        if (!segmentIds.has(annotation.passageId) && !segmentIds.has(annotation.sectionId)) failures.push(`${expected.id}: annotation points outside stable identity graph`);
      }
      const personIds = new Set();
      for (const relation of world.people) {
        if (personIds.has(relation.id)) failures.push(`${expected.id}: duplicate world person ${relation.id}`);
        personIds.add(relation.id);
        if (relation.featured && relation.passageIds.length === 0) failures.push(`${expected.id}: featured person ${relation.id} has no passage placement`);
        for (const passageId of relation.passageIds) {
          if (!segmentIds.has(passageId)) failures.push(`${expected.id}: person ${relation.id} points outside stable identity graph at ${passageId}`);
        }
      }
      const sourceIds = new Set();
      for (const source of [...sources.primarySources, ...sources.companionSources]) {
        if (sourceIds.has(source.id)) failures.push(`${expected.id}: duplicate chapter source ${source.id}`);
        sourceIds.add(source.id);
        for (const passageId of source.passageIds) {
          if (!segmentIds.has(passageId)) failures.push(`${expected.id}: source ${source.id} points outside stable identity graph at ${passageId}`);
        }
      }
      totals.asides += occurrences(markdown, /<aside\b/g);
      totals.tables += occurrences(markdown, /<table\b/g);
      totals.explicitIds += occurrences(markdown, /\bid="[^"]+"/g);
      totals.ariaLabelledby += occurrences(markdown, /\baria-labelledby="[^"]+"/g);
      totals.markdownTables += occurrences(markdown, /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm);
      totals.sections += occurrences(markdown, /<!-- phil-section-id:/g);
      totals.passages += occurrences(markdown, /<!-- phil-passage-id:/g);
    } catch (error) {
      failures.push(`${expected.id}: ${error.message}`);
    }
  }

  if (totals.asides !== baseline.rawHtml.asides) failures.push(`raw aside baseline changed: ${totals.asides}`);
  if (totals.tables !== baseline.rawHtml.tables) failures.push(`raw table baseline changed: ${totals.tables}`);
  if (totals.explicitIds !== baseline.rawHtml.explicitIds) failures.push(`explicit HTML ID baseline changed: ${totals.explicitIds}`);
  if (totals.ariaLabelledby !== baseline.rawHtml.ariaLabelledby) failures.push(`aria-labelledby baseline changed: ${totals.ariaLabelledby}`);
  if (totals.markdownTables !== baseline.markdownTables) failures.push(`Markdown table baseline changed: ${totals.markdownTables}`);
  if (totals.sections !== baseline.identity.sections || totals.passages !== baseline.identity.passages) failures.push(`stable identity baseline changed: ${totals.sections} sections / ${totals.passages} passages`);

  const testing = await readFile(path.join(chaptersRoot, "02-testing-moral-arguments", "chapter.md"), "utf8");
  const delegating = await readFile(path.join(chaptersRoot, "13-delegating-judgment", "chapter.md"), "utf8");
  if (occurrences(testing, /^# Testing Moral Arguments: Premises, Inferences, Objections, and Revision$/gm) !== 1) failures.push("Testing Moral Arguments H1 repair is missing");
  const websiteAristotleLink = "/chapter/aristotle-character-and-ai-assisted-life/";
  if (delegating.split(websiteAristotleLink).length - 1 !== 2) failures.push("Delegating Judgment Aristotle website link repair is missing or over-applied");
  for (const excluded of map.excludedSources) {
    const excludedSlug = path.basename(path.dirname(excluded.sourcePath));
    if (directories.some((directory) => directory.includes(excludedSlug))) failures.push(`excluded optional source was imported: ${excluded.sourcePath}`);
  }
  for (const chapter of map.chapters) {
    if (path.isAbsolute(chapter.sourcePath) || chapter.sourcePath.split(/[\\/]/).includes("..")) failures.push(`${chapter.id}: public reconciliation map contains unsafe source path`);
    if (!mapByOrder.has(chapter.order)) failures.push(`${chapter.id}: map ordering failure`);
  }
  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(`Content validation passed: 18 chapters / 6 Parts, ${totals.sections} sections, ${totals.passages} passages; migration baselines and bounded repairs preserved.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
