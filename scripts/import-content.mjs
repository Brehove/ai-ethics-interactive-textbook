#!/usr/bin/env node

import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  applyTransformations,
  buildReadingArtifacts,
  chapterDirectoryName,
  extractLeadingTitle,
  instrumentMarkdown,
  normalizeNewlines,
  readJson,
  sha256,
  writeJson,
  writeText,
} from "./content-model-lib.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

function parseArguments(argv) {
  const options = {
    map: path.join(projectRoot, "content", "reconciliation-map.json"),
    outputRoot: path.join(projectRoot, "content"),
    sourceRoot: null,
    write: false,
    check: false,
    replace: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write") options.write = true;
    else if (argument === "--check") options.check = true;
    else if (argument === "--replace") options.replace = true;
    else if (argument === "--map") options.map = path.resolve(argv[++index]);
    else if (argument === "--output-root") options.outputRoot = path.resolve(argv[++index]);
    else if (argument === "--source-root") options.sourceRoot = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.sourceRoot) throw new Error("--source-root is required; private source locations are never persisted in the public map");
  if (options.write === options.check) throw new Error("Choose exactly one mode: --write or --check");
  if (options.replace && !options.write) throw new Error("--replace is valid only with --write");
  return options;
}

function validateMap(map) {
  if (map.schemaVersion !== 1) throw new Error(`Unsupported reconciliation schema ${map.schemaVersion}`);
  if (map.chapters.length !== map.expectedChapterCount || map.expectedChapterCount !== 18) {
    throw new Error(`Reconciliation map must select exactly 18 chapters; found ${map.chapters.length}`);
  }
  const ids = new Set();
  const slugs = new Set();
  const orders = new Set();
  for (const chapter of map.chapters) {
    if (ids.has(chapter.id) || slugs.has(chapter.slug) || orders.has(chapter.order)) {
      throw new Error(`Duplicate id, slug, or order at ${chapter.id}`);
    }
    ids.add(chapter.id);
    slugs.add(chapter.slug);
    orders.add(chapter.order);
    if (path.isAbsolute(chapter.sourcePath) || chapter.sourcePath.split(/[\\/]/).includes("..")) {
      throw new Error(`${chapter.id}: sourcePath must be a safe path relative to --source-root`);
    }
  }
  const expectedOrders = Array.from({ length: 18 }, (_, index) => index + 1);
  if (expectedOrders.some((order) => !orders.has(order))) throw new Error("Chapter orders must be contiguous from 1 through 18");
}

function createBook(map, generatedChapters) {
  const partMap = new Map();
  for (const { chapter, meta } of generatedChapters) {
    if (!partMap.has(chapter.part.id)) {
      partMap.set(chapter.part.id, {
        id: chapter.part.id,
        order: chapter.part.order,
        title: chapter.part.title,
        slug: chapter.part.slug,
        chapters: [],
      });
    }
    partMap.get(chapter.part.id).chapters.push({
      id: chapter.id,
      slug: chapter.slug,
      title: chapter.title,
      order: chapter.order,
      chapterOrder: chapter.part.chapterOrder,
      path: meta.path,
    });
  }
  const parts = [...partMap.values()]
    .sort((left, right) => left.order - right.order)
    .map((part) => ({ ...part, chapters: part.chapters.sort((left, right) => left.chapterOrder - right.chapterOrder) }));
  return {
    schemaVersion: 1,
    id: map.bookId,
    title: "PHIL 123: AI and Ethics",
    subtitle: "An interactive open textbook for philosophical judgment",
    language: "en",
    edition: "Website baseline (2026)",
    chapterCount: generatedChapters.length,
    licensePolicy: "policies/licenses.json",
    privacy: { studentAccounts: false, studentDataStored: false },
    parts,
  };
}

async function generateChapter(chapter, sourceRoot, rightsRegistry) {
  const sourcePath = path.resolve(sourceRoot, chapter.sourcePath);
  const relative = path.relative(sourceRoot, sourcePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${chapter.id}: source escaped --source-root`);
  const rawSource = await readFile(sourcePath, "utf8");
  const sourceHash = sha256(rawSource);
  if (sourceHash !== chapter.selectedSourceSha256) {
    throw new Error(`${chapter.id}: selected source hash mismatch; expected ${chapter.selectedSourceSha256}, found ${sourceHash}`);
  }

  const transformed = normalizeNewlines(applyTransformations(rawSource, chapter.transformations, chapter.id));
  const transformedTitle = extractLeadingTitle(transformed);
  if (transformedTitle !== chapter.title) {
    throw new Error(`${chapter.id}: transformed H1 "${transformedTitle}" does not match approved title "${chapter.title}"`);
  }
  const markdown = instrumentMarkdown(transformed, chapter.id);
  const artifacts = buildReadingArtifacts(markdown, chapter);
  const contentKey = chapterDirectoryName(chapter);
  const referencedRights = chapter.rightsRecordIds.map((id) => rightsRegistry.records.find((record) => record.id === id));
  if (referencedRights.some((record) => !record)) throw new Error(`${chapter.id}: unresolved rights record`);
  const thirdPartyExceptions = referencedRights.filter((record) => record.kind === "license-exception").map((record) => record.id);

  const pressbooksUrl = `https://cwi.pressbooks.pub/ethicsandai/chapter/${chapter.slug}/`;
  const meta = {
    schemaVersion: 1,
    id: chapter.id,
    contentKey,
    slug: chapter.slug,
    title: chapter.title,
    subtitle: null,
    description: artifacts.description,
    order: chapter.order,
    part: chapter.part,
    path: `/chapter/${chapter.slug}/`,
    wordCount: artifacts.reading.wordCount,
    readingMinutes: artifacts.reading.readingMinutes,
    pressbooksUrl,
    status: "website-canonical",
    licenses: {
      prose: "CC-BY-4.0",
      code: "MIT",
      originalMetadata: "CC0-1.0",
      thirdPartyExceptions,
    },
    rightsRecordIds: chapter.rightsRecordIds,
    exports: { print: true, offlineHtml: true, readingJson: true, plainText: true },
    pressbooks: {
      id: chapter.pressbooksId,
      sourceFormat: "gfm+raw-html",
      compatible: true,
      validated: false,
      publishAuthorized: false,
      priorRelease: chapter.priorRelease,
    },
    websiteBaseline: {
      selectedSourceSha256: chapter.selectedSourceSha256,
      canonicalMarkdownSha256: sha256(markdown),
      reconciliationTransformations: chapter.transformations.map(({ kind, reason, expectedOccurrences }) => ({ kind, reason, expectedOccurrences })),
      selectionNote: chapter.selectionNote ?? "Imported from the current resolved published-manifest source route.",
    },
  };

  const annotations = {
    schemaVersion: 1,
    chapterId: chapter.id,
    license: "CC0-1.0",
    items: [],
  };
  const sourceLinks = {
    schemaVersion: 1,
    chapterId: chapter.id,
    license: "CC0-1.0",
    primarySources: [],
    companionSources: [],
  };
  const world = {
    schemaVersion: 1,
    chapterId: chapter.id,
    license: "CC0-1.0",
    people: [],
    concepts: [],
    traditions: [],
    places: [],
  };
  const rights = {
    schemaVersion: 1,
    chapterId: chapter.id,
    proseLicense: "CC-BY-4.0",
    rightsRecordIds: chapter.rightsRecordIds,
    thirdPartyExceptions,
  };

  return { chapter, meta, markdown, ...artifacts, annotations, sourceLinks, world, rights };
}

function expectedFiles(outputRoot, map, generatedChapters) {
  const files = new Map();
  const book = createBook(map, generatedChapters);
  files.set(path.join(outputRoot, "book.json"), `${JSON.stringify(book, null, 2)}\n`);
  for (const generated of generatedChapters) {
    const directory = path.join(outputRoot, "chapters", generated.meta.contentKey);
    files.set(path.join(directory, "chapter.md"), normalizeNewlines(generated.markdown));
    files.set(path.join(directory, "meta.json"), `${JSON.stringify(generated.meta, null, 2)}\n`);
    files.set(path.join(directory, "annotations.json"), `${JSON.stringify(generated.annotations, null, 2)}\n`);
    files.set(path.join(directory, "source-links.json"), `${JSON.stringify(generated.sourceLinks, null, 2)}\n`);
    files.set(path.join(directory, "world.json"), `${JSON.stringify(generated.world, null, 2)}\n`);
    files.set(path.join(directory, "rights.json"), `${JSON.stringify(generated.rights, null, 2)}\n`);
    files.set(path.join(directory, "reading.json"), `${JSON.stringify(generated.reading, null, 2)}\n`);
    files.set(path.join(directory, "reading.txt"), normalizeNewlines(generated.plainText));
  }
  return files;
}

async function assertNoExistingTargets(files) {
  const existing = [];
  for (const filePath of files.keys()) {
    try {
      await lstat(filePath);
      existing.push(path.relative(projectRoot, filePath));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (existing.length) {
    throw new Error(`Refusing to overwrite ${existing.length} existing generated file(s). Re-run with --replace only after reviewing canonical edits.`);
  }
}

async function writeFiles(files) {
  for (const [filePath, content] of files) {
    if (filePath.endsWith(".json")) await writeJson(filePath, JSON.parse(content));
    else await writeText(filePath, content);
  }
}

async function checkFiles(files) {
  const failures = [];
  for (const [filePath, expected] of files) {
    try {
      const actual = await readFile(filePath, "utf8");
      if (actual !== expected) failures.push(`${path.relative(projectRoot, filePath)} differs`);
      const stat = await lstat(filePath);
      if (stat.isSymbolicLink()) failures.push(`${path.relative(projectRoot, filePath)} is a symlink`);
    } catch (error) {
      failures.push(`${path.relative(projectRoot, filePath)}: ${error.code ?? error.message}`);
    }
  }
  if (failures.length) throw new Error(`Import check failed:\n- ${failures.join("\n- ")}`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const map = await readJson(options.map);
  const rightsRegistry = await readJson(path.join(options.outputRoot, "rights", "registry.json"));
  validateMap(map);
  const generatedChapters = [];
  for (const chapter of [...map.chapters].sort((left, right) => left.order - right.order)) {
    generatedChapters.push(await generateChapter(chapter, options.sourceRoot, rightsRegistry));
  }
  const files = expectedFiles(options.outputRoot, map, generatedChapters);
  if (options.write) {
    if (!options.replace) await assertNoExistingTargets(files);
    await writeFiles(files);
    process.stdout.write(`Materialized ${generatedChapters.length} chapters in ${path.relative(projectRoot, options.outputRoot) || "."}.\n`);
  } else {
    await checkFiles(files);
    process.stdout.write(`Import check passed for ${generatedChapters.length} chapters and ${files.size} generated files.\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
