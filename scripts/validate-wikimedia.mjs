#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import {
  MAX_PORTRAIT_BYTES,
  MAX_PORTRAIT_WIDTH,
  PORTRAIT_WEBP_QUALITY,
  sha256,
  stableJson,
  validateWikimediaManifest,
} from "./wikimedia-lib.mjs";

const DEFAULT_PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MACHINE_ONLY_PERSON_FIELDS = [
  "biography",
  "displayName",
  "links",
  "portraitId",
  "sortName",
  "teaching",
];
const MACHINE_ONLY_MEDIA_FIELDS = [
  "alt",
  "caption",
  "rightsReview",
  "teachingUse",
  "title",
];

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(process.cwd(), filePath)}: ${error.message}`);
  }
}

async function jsonRecords(directory, label) {
  let names;
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
  const records = new Map();
  for (const name of names.filter((item) => item.endsWith(".json")).sort()) {
    const filePath = path.join(directory, name);
    const record = await readJson(filePath);
    const fileId = name.slice(0, -5);
    if (record.id !== fileId) throw new Error(`${label} ${name}: record id must match its filename`);
    if (records.has(record.id)) throw new Error(`${label}: duplicate id ${record.id}`);
    records.set(record.id, { filePath, record });
  }
  return records;
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function expectStableGeneratedJson(item, root) {
  return readFile(item.filePath, "utf8").then((source) => {
    expect(source === stableJson(item.record), `${path.relative(root, item.filePath)} is not canonical deterministic JSON`);
  });
}

function assertNoHumanAuthoredFields(record, fields, label) {
  const leaked = fields.filter((field) => Object.hasOwn(record, field));
  expect(leaked.length === 0, `${label} contains human-authored field(s): ${leaked.join(", ")}`);
}

function assertWikidataSource(record, manifestEntry) {
  const label = `Generated person ${manifestEntry.id}`;
  expect(record.schemaVersion === 1, `${label}: unsupported schemaVersion`);
  expect(record.id === manifestEntry.id, `${label}: id mismatch`);
  expect(record.wikidataId === manifestEntry.wikidataId, `${label}: Wikidata id mismatch`);
  expect(record.source?.provider === "Wikidata", `${label}: provider must be Wikidata`);
  expect(Number.isInteger(record.source?.revisionId) && record.source.revisionId > 0, `${label}: source revision is missing`);
  expect(isSha256(record.source?.checksumSha256), `${label}: source checksum is missing or invalid`);
  expect(record.source?.license === "CC0-1.0", `${label}: structured data license must be CC0-1.0`);
  expect(
    record.source?.licenseUrl === "https://creativecommons.org/publicdomain/zero/1.0/",
    `${label}: structured data license URL is invalid`,
  );
  expect(record.source?.entityUrl === `https://www.wikidata.org/wiki/${manifestEntry.wikidataId}`, `${label}: entity URL mismatch`);
  assertNoHumanAuthoredFields(record, MACHINE_ONLY_PERSON_FIELDS, label);
}

function assertCommonsSource(record, manifestEntry) {
  const portrait = manifestEntry.portrait;
  const label = `Generated media ${portrait.id}`;
  expect(record.schemaVersion === 1, `${label}: unsupported schemaVersion`);
  expect(record.id === portrait.id && record.personId === manifestEntry.id, `${label}: person or media id mismatch`);
  expect(record.commonsTitle === portrait.commonsTitle, `${label}: Commons title mismatch`);
  expect(record.source?.provider === "Wikimedia Commons", `${label}: provider must be Wikimedia Commons`);
  expect(Number.isInteger(record.source?.revisionId) && record.source.revisionId > 0, `${label}: source revision is missing`);
  expect(isSha256(record.source?.checksumSha256), `${label}: source checksum is missing or invalid`);
  expect(record.source?.metadataLicense === "CC0-1.0", `${label}: Commons metadata license must be CC0-1.0`);
  expect(record.derivative?.localPath === `/${portrait.downloadPath}`, `${label}: vendored asset path does not match manifest`);
  expect(isSha256(record.derivative?.sha256), `${label}: vendored asset checksum is missing or invalid`);
  expect(record.derivative?.mime === "image/webp", `${label}: vendored asset must be WebP`);
  expect(
    Number.isInteger(record.derivative?.bytes) && record.derivative.bytes > 0 && record.derivative.bytes <= MAX_PORTRAIT_BYTES,
    `${label}: vendored asset must be at most ${MAX_PORTRAIT_BYTES} bytes`,
  );
  expect(
    Number.isInteger(record.derivative?.width) && record.derivative.width > 0 && record.derivative.width <= MAX_PORTRAIT_WIDTH,
    `${label}: vendored asset must be at most ${MAX_PORTRAIT_WIDTH}px wide`,
  );
  expect(Number.isInteger(record.derivative?.height) && record.derivative.height > 0, `${label}: vendored asset height is invalid`);
  expect(
    record.derivative?.modification?.includes(`WebP quality ${PORTRAIT_WEBP_QUALITY}`),
    `${label}: deterministic optimization description is missing`,
  );
  expect(typeof record.rights?.licenseShortName === "string" && record.rights.licenseShortName.length > 0, `${label}: license name is missing`);
  expect(typeof record.rights?.usageTerms === "string" && record.rights.usageTerms.length > 0, `${label}: usage terms are missing`);
  expect(typeof record.rights?.artist === "string" && record.rights.artist.length > 0, `${label}: artist is missing`);
  expect(typeof record.rights?.attributionRequired === "boolean", `${label}: attribution requirement is missing`);
  assertNoHumanAuthoredFields(record, MACHINE_ONLY_MEDIA_FIELDS, label);
}

function assertHumanReview(media, generated) {
  const label = `Curated media ${media.id}`;
  expect(media.rightsReview?.status === "approved", `${label}: portrait cannot ship until rightsReview.status is approved`);
  expect(typeof media.rightsReview?.reviewedAt === "string" && !Number.isNaN(Date.parse(media.rightsReview.reviewedAt)), `${label}: reviewedAt is missing or invalid`);
  expect(
    media.rightsReview?.sourceRevisionId === generated.source.revisionId,
    `${label}: approved sourceRevisionId must equal Commons revision ${generated.source.revisionId}; re-review after refresh`,
  );
}

async function listAssetFiles(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => path.join(directory, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function assertChapterSourceRelationships(projectRoot, people) {
  const chapterRoot = path.join(projectRoot, "content", "chapters");
  const directories = (await readdir(chapterRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const sources = new Map();

  for (const directory of directories) {
    const filePath = path.join(chapterRoot, directory, "source-links.json");
    const record = await readJson(filePath);
    for (const source of [...(record.primarySources ?? []), ...(record.companionSources ?? [])]) {
      expect(!sources.has(source.id), `Duplicate chapter source id ${source.id}`);
      sources.set(source.id, source);
      if (source.authorPersonId) {
        const person = people.get(source.authorPersonId)?.record;
        expect(person, `Source ${source.id}: unknown authorPersonId ${source.authorPersonId}`);
        expect(
          person.teaching?.primarySourceIds?.includes(source.id),
          `Source ${source.id}: ${source.authorPersonId} does not declare this primarySourceId`,
        );
      }
    }
  }

  for (const { record: person } of people.values()) {
    for (const sourceId of person.teaching?.primarySourceIds ?? []) {
      const source = sources.get(sourceId);
      expect(source, `Curated person ${person.id}: unknown primarySourceId ${sourceId}`);
      expect(source.authorPersonId === person.id, `Curated person ${person.id}: source ${sourceId} names ${source.authorPersonId ?? "no author"}`);
    }
  }
}

export async function validateWikimediaLayer({ projectRoot = DEFAULT_PROJECT_ROOT } = {}) {
  const manifestPath = path.join(projectRoot, "content", "entities", "people", "wikimedia-manifest.json");
  const manifest = validateWikimediaManifest(await readJson(manifestPath));
  const people = await jsonRecords(path.join(projectRoot, "content", "entities", "people", "records"), "Curated people");
  const generatedPeople = await jsonRecords(path.join(projectRoot, "content", "entities", "people", "wikimedia"), "Generated people");
  const media = await jsonRecords(path.join(projectRoot, "content", "media", "records"), "Curated media");
  const generatedMedia = await jsonRecords(path.join(projectRoot, "content", "media", "wikimedia"), "Generated media");
  const manifestPeople = new Set(manifest.people.map((entry) => entry.id));
  const manifestMedia = new Set(manifest.people.flatMap((entry) => entry.portrait ? [entry.portrait.id] : []));

  for (const id of people.keys()) expect(manifestPeople.has(id), `Curated person ${id} is absent from the Wikimedia manifest`);
  for (const id of generatedPeople.keys()) expect(manifestPeople.has(id), `Generated person ${id} is absent from the Wikimedia manifest`);
  for (const id of media.keys()) expect(manifestMedia.has(id), `Curated media ${id} is absent from the Wikimedia manifest`);
  for (const id of generatedMedia.keys()) expect(manifestMedia.has(id), `Generated media ${id} is absent from the Wikimedia manifest`);

  const expectedAssets = new Set();
  for (const entry of manifest.people) {
    const curatedPerson = people.get(entry.id);
    const generatedPerson = generatedPeople.get(entry.id);
    expect(curatedPerson, `Manifest person ${entry.id} has no curated person record`);
    expect(generatedPerson, `Manifest person ${entry.id} has no generated Wikidata record; run npm run wikimedia:refresh`);
    expect(curatedPerson.record.wikidataId === undefined, `Curated person ${entry.id}: wikidataId belongs in generated metadata`);
    assertWikidataSource(generatedPerson.record, entry);
    await expectStableGeneratedJson(generatedPerson, projectRoot);

    if (!entry.portrait) {
      expect(curatedPerson.record.portraitId === null, `Curated person ${entry.id}: portraitId must be null when the manifest has no portrait`);
      continue;
    }

    expect(curatedPerson.record.portraitId === entry.portrait.id, `Curated person ${entry.id}: portraitId does not match manifest`);
    const curatedMedia = media.get(entry.portrait.id);
    const machineMedia = generatedMedia.get(entry.portrait.id);
    expect(curatedMedia, `Manifest portrait ${entry.portrait.id} has no curated media record`);
    expect(machineMedia, `Manifest portrait ${entry.portrait.id} has no generated Commons record; run npm run wikimedia:refresh`);
    assertCommonsSource(machineMedia.record, entry);
    assertHumanReview(curatedMedia.record, machineMedia.record);
    await expectStableGeneratedJson(machineMedia, projectRoot);

    const assetPath = path.join(projectRoot, "public", entry.portrait.downloadPath);
    const asset = await readFile(assetPath).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Vendored portrait is missing: ${path.relative(projectRoot, assetPath)}`);
      throw error;
    });
    expect(asset.length === machineMedia.record.derivative.bytes, `${entry.portrait.id}: vendored asset byte count drifted`);
    expect(sha256(asset) === machineMedia.record.derivative.sha256, `${entry.portrait.id}: vendored asset checksum drifted`);
    const image = await sharp(asset).metadata();
    expect(image.format === "webp", `${entry.portrait.id}: vendored asset bytes are not WebP`);
    expect(image.width === machineMedia.record.derivative.width, `${entry.portrait.id}: recorded width does not match asset bytes`);
    expect(image.height === machineMedia.record.derivative.height, `${entry.portrait.id}: recorded height does not match asset bytes`);
    expect(!image.pages || image.pages === 1, `${entry.portrait.id}: animated or multipage portraits are not allowed`);
    expectedAssets.add(path.resolve(assetPath));
  }

  const assetDirectory = path.join(projectRoot, "public", "media", "wikimedia");
  for (const filePath of await listAssetFiles(assetDirectory)) {
    expect(expectedAssets.has(path.resolve(filePath)), `${path.relative(projectRoot, filePath)} is not declared in the Wikimedia manifest`);
  }

  await assertChapterSourceRelationships(projectRoot, people);

  return {
    people: manifest.people.length,
    media: manifestMedia.size,
    assets: expectedAssets.size,
  };
}

function parseArguments(argv) {
  if (argv.length === 0) return { projectRoot: DEFAULT_PROJECT_ROOT };
  if (argv.length === 2 && argv[0] === "--root") return { projectRoot: path.resolve(argv[1]) };
  throw new Error("Usage: node scripts/validate-wikimedia.mjs [--root <project-root>]");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateWikimediaLayer(parseArguments(process.argv.slice(2)))
    .then((result) => {
      process.stdout.write(`Wikimedia layer valid: ${result.people} people, ${result.media} media, ${result.assets} vendored assets.\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
