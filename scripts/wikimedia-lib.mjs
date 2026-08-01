import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const MAX_WIKIMEDIA_CONCURRENCY = 3;
export const MAX_PORTRAIT_WIDTH = 720;
export const MAX_PORTRAIT_BYTES = 250_000;
export const PORTRAIT_WEBP_QUALITY = 82;
export const DEFAULT_WIKIMEDIA_USER_AGENT =
  "PHIL123InteractiveTextbook/0.1 (https://github.com/Brehove/ai-ethics-interactive-textbook; educational OER refresh)";

const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php";
const COMMONS_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";
const ENTITY_PROPERTY_MAP = {
  birthDates: "P569",
  deathDates: "P570",
  birthPlaces: "P19",
  deathPlaces: "P20",
  occupations: "P106",
  movements: "P135",
  countriesOfCitizenship: "P27",
  notableWorks: "P800",
};

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export async function mapWithConcurrency(items, limit, worker) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_WIKIMEDIA_CONCURRENCY) {
    throw new Error(`Wikimedia concurrency must be an integer from 1 to ${MAX_WIKIMEDIA_CONCURRENCY}`);
  }
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function validateUserAgent(userAgent) {
  if (!userAgent || (!userAgent.includes("http") && !userAgent.includes("@"))) {
    throw new Error("Wikimedia User-Agent must identify the client and include a contact URL or address");
  }
}

export function createWikimediaClient({
  fetchImpl = globalThis.fetch,
  sleepImpl = sleep,
  userAgent = DEFAULT_WIKIMEDIA_USER_AGENT,
  maxAttempts = 4,
  requestTimeoutMs = 20_000,
  now = () => Date.now(),
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) throw new Error("requestTimeoutMs must be a positive integer");
  validateUserAgent(userAgent);

  async function request(url, responseType) {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          method: "GET",
          headers: {
            "User-Agent": userAgent,
            "Api-User-Agent": userAgent,
            Accept: responseType === "json" ? "application/json" : "image/*",
            "Accept-Encoding": "gzip, deflate",
          },
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        const retryableStatus = [429, 502, 503, 504].includes(response.status);
        if (retryableStatus) {
          const wait = parseRetryAfter(response.headers.get("retry-after"), now()) ?? Math.min(30_000, 1000 * 2 ** attempt);
          lastError = new Error(`Wikimedia request returned ${response.status}`);
          if (attempt + 1 < maxAttempts) {
            await sleepImpl(wait);
            continue;
          }
        }
        if (!response.ok) throw new Error(`Wikimedia request failed with HTTP ${response.status}`);
        if (responseType === "buffer") {
          return {
            body: Buffer.from(await response.arrayBuffer()),
            contentType: response.headers.get("content-type")?.split(";")[0] ?? null,
            finalUrl: response.url || String(url),
          };
        }
        const body = await response.json();
        if (body?.error?.code === "maxlag" || body?.error?.code === "ratelimited") {
          const wait = parseRetryAfter(response.headers.get("retry-after"), now()) ?? Math.min(30_000, 1000 * 2 ** attempt);
          lastError = new Error(`Wikimedia API requested retry: ${body.error.code}`);
          if (attempt + 1 < maxAttempts) {
            await sleepImpl(wait);
            continue;
          }
        }
        if (body?.error) throw new Error(`Wikimedia API error ${body.error.code ?? "unknown"}: ${body.error.info ?? "no detail"}`);
        return body;
      } catch (error) {
        lastError = error;
        if (attempt + 1 >= maxAttempts) break;
        await sleepImpl(Math.min(30_000, 1000 * 2 ** attempt));
      }
    }
    throw lastError ?? new Error("Wikimedia request failed");
  }

  return {
    requestJson: (url) => request(url, "json"),
    requestBuffer: (url) => request(url, "buffer"),
    userAgent,
  };
}

function apiUrl(endpoint, parameters) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

function claims(entity, property) {
  return (entity.claims?.[property] ?? [])
    .filter((claim) => claim.rank !== "deprecated" && claim.mainsnak?.snaktype === "value" && claim.mainsnak?.datavalue)
    .sort((left, right) => {
      const rank = { preferred: 0, normal: 1, deprecated: 2 };
      return (rank[left.rank] ?? 3) - (rank[right.rank] ?? 3) || String(left.id).localeCompare(String(right.id), "en");
    });
}

function entityIdFromClaim(claim) {
  const value = claim.mainsnak.datavalue.value;
  if (typeof value?.id === "string") return value.id;
  if (Number.isInteger(value?.["numeric-id"])) return `Q${value["numeric-id"]}`;
  return null;
}

function timeFromClaim(claim) {
  const value = claim.mainsnak.datavalue.value;
  if (claim.mainsnak.datavalue.type !== "time" || !value?.time) return null;
  return {
    time: value.time,
    precision: value.precision,
    calendarModel: value.calendarmodel ?? value.calendarModel ?? "",
  };
}

function referencedEntityIds(entities) {
  const ids = new Set();
  for (const entity of entities) {
    for (const property of Object.values(ENTITY_PROPERTY_MAP).filter((value) => !["P569", "P570"].includes(value))) {
      for (const claim of claims(entity, property)) {
        const id = entityIdFromClaim(claim);
        if (id) ids.add(id);
      }
    }
  }
  return [...ids].sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
}

function uniqueSorted(values, key) {
  const map = new Map();
  for (const value of values) map.set(key(value), value);
  return [...map.values()].sort((left, right) => key(left).localeCompare(key(right), "en"));
}

function normalizeEntityReferences(entity, property, labels) {
  const values = claims(entity, property)
    .map(entityIdFromClaim)
    .filter(Boolean)
    .map((id) => ({ id, label: labels.get(id) ?? id }));
  return uniqueSorted(values, (value) => value.id);
}

function normalizeTimes(entity, property) {
  return uniqueSorted(claims(entity, property).map(timeFromClaim).filter(Boolean), (value) => `${value.time}:${value.precision}:${value.calendarModel}`);
}

function stringClaim(entity, property) {
  const value = claims(entity, property)[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" ? value : null;
}

export function normalizeWikidataEntity(entry, entity, labels, language = "en") {
  if (!entity || entity.missing) throw new Error(`${entry.id}: Wikidata entity ${entry.wikidataId} is missing`);
  if (!Number.isInteger(entity.lastrevid) || !entity.modified) throw new Error(`${entry.id}: Wikidata revision metadata is missing`);
  const label = entity.labels?.[language]?.value;
  if (!label) throw new Error(`${entry.id}: Wikidata has no ${language} label`);
  const sitelink = entity.sitelinks?.[`${language}wiki`] ?? null;
  return {
    schemaVersion: 1,
    id: entry.id,
    wikidataId: entry.wikidataId,
    label,
    description: entity.descriptions?.[language]?.value ?? null,
    aliases: [...new Set((entity.aliases?.[language] ?? []).map((alias) => alias.value).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en")),
    facts: {
      birthDates: normalizeTimes(entity, ENTITY_PROPERTY_MAP.birthDates),
      deathDates: normalizeTimes(entity, ENTITY_PROPERTY_MAP.deathDates),
      birthPlaces: normalizeEntityReferences(entity, ENTITY_PROPERTY_MAP.birthPlaces, labels),
      deathPlaces: normalizeEntityReferences(entity, ENTITY_PROPERTY_MAP.deathPlaces, labels),
      occupations: normalizeEntityReferences(entity, ENTITY_PROPERTY_MAP.occupations, labels),
      movements: normalizeEntityReferences(entity, ENTITY_PROPERTY_MAP.movements, labels),
      countriesOfCitizenship: normalizeEntityReferences(entity, ENTITY_PROPERTY_MAP.countriesOfCitizenship, labels),
      notableWorks: normalizeEntityReferences(entity, ENTITY_PROPERTY_MAP.notableWorks, labels),
    },
    wikipedia: sitelink?.title && sitelink?.url ? { title: sitelink.title, url: sitelink.url } : null,
    commonsImageClaim: stringClaim(entity, "P18"),
    source: {
      provider: "Wikidata",
      entityUrl: `https://www.wikidata.org/wiki/${entry.wikidataId}`,
      revisionId: entity.lastrevid,
      modified: entity.modified,
      checksumSha256: sha256(stableJson(entity)),
      license: "CC0-1.0",
      licenseUrl: WIKIDATA_CC0,
    },
  };
}

async function fetchWikidataEntries(manifest, client) {
  const language = manifest.language;
  const entities = new Map();
  for (const batch of chunks(manifest.people.map((person) => person.wikidataId), 50)) {
    const url = apiUrl(WIKIDATA_ENDPOINT, {
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "info|labels|descriptions|aliases|claims|sitelinks/urls",
      languages: language,
      languagefallback: 1,
      sitefilter: `${language}wiki`,
      format: "json",
      formatversion: 2,
      maxlag: 5,
    });
    const response = await client.requestJson(url);
    for (const [id, entity] of Object.entries(response.entities ?? {})) entities.set(id, entity);
  }
  const referenceIds = referencedEntityIds([...entities.values()]);
  const labels = new Map();
  for (const batch of chunks(referenceIds, 50)) {
    const url = apiUrl(WIKIDATA_ENDPOINT, {
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "labels",
      languages: language,
      languagefallback: 1,
      format: "json",
      formatversion: 2,
      maxlag: 5,
    });
    const response = await client.requestJson(url);
    for (const [id, entity] of Object.entries(response.entities ?? {})) {
      labels.set(id, entity.labels?.[language]?.value ?? id);
    }
  }
  return manifest.people.map((entry) => normalizeWikidataEntity(entry, entities.get(entry.wikidataId), labels, language));
}

function decodeHtmlEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function plainMetadata(value) {
  if (!value) return null;
  return decodeHtmlEntities(String(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || null;
}

function externalUrl(value) {
  if (!value) return null;
  return value.startsWith("//") ? `https:${value}` : value;
}

function assertCommonsDownloadUrl(value, personId) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${personId}: Commons returned an invalid download URL`);
  }
  if (url.protocol !== "https:" || url.hostname !== "upload.wikimedia.org") {
    throw new Error(`${personId}: refused non-HTTPS or non-Wikimedia download host ${url.hostname}`);
  }
  return url;
}

function metadataValue(info, key) {
  return info.extmetadata?.[key]?.value ?? null;
}

function commonsPageUrl(title) {
  const page = encodeURIComponent(title.replaceAll(" ", "_")).replace(/^File%3A/, "File:");
  return `https://commons.wikimedia.org/wiki/${page}`;
}

export async function optimizePortrait(input, requestedWidth) {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new Error("Portrait input must be a non-empty Buffer");
  const firstWidth = Math.min(requestedWidth, MAX_PORTRAIT_WIDTH);
  const widths = [...new Set([firstWidth, 640, 560, 480, 400, 320].filter((width) => width <= firstWidth))];
  let lastResult;
  for (const width of widths) {
    const result = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: PORTRAIT_WEBP_QUALITY, effort: 6, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    lastResult = result;
    if (result.data.length <= MAX_PORTRAIT_BYTES) {
      return {
        body: result.data,
        width: result.info.width,
        height: result.info.height,
        mime: "image/webp",
        quality: PORTRAIT_WEBP_QUALITY,
        targetWidth: width,
      };
    }
  }
  throw new Error(
    `Optimized portrait remains ${lastResult?.data.length ?? "unknown"} bytes at ${lastResult?.info.width ?? "unknown"}px; budget is ${MAX_PORTRAIT_BYTES} bytes`,
  );
}

export function normalizeCommonsRecord(entry, page, downloaded, optimized) {
  const portrait = entry.portrait;
  if (!portrait) throw new Error(`${entry.id}: no portrait manifest entry`);
  if (!page || page.missing) throw new Error(`${entry.id}: Commons file ${portrait.commonsTitle} is missing`);
  const info = page.imageinfo?.[0];
  const revision = page.revisions?.[0];
  if (!info) throw new Error(`${entry.id}: Commons imageinfo is missing for ${portrait.commonsTitle}`);
  if (!Number.isInteger(page.lastrevid) || !revision?.timestamp) throw new Error(`${entry.id}: Commons revision metadata is missing`);
  const licenseShortName = plainMetadata(metadataValue(info, "LicenseShortName"));
  const usageTerms = plainMetadata(metadataValue(info, "UsageTerms"));
  const artist = plainMetadata(metadataValue(info, "Artist"));
  if (!licenseShortName || !usageTerms || !artist) {
    throw new Error(`${entry.id}: Commons rights metadata must include license, usage terms, and artist`);
  }
  const sourceUrl = externalUrl(info.thumburl ?? info.url);
  if (!sourceUrl) throw new Error(`${entry.id}: Commons file URL is missing`);
  const downloadedMime = downloaded.contentType ?? info.thumbmime ?? info.mime;
  if (!downloadedMime?.startsWith("image/")) throw new Error(`${entry.id}: downloaded Commons derivative is not an image`);
  return {
    schemaVersion: 1,
    id: portrait.id,
    personId: entry.id,
    commonsTitle: page.title,
    source: {
      provider: "Wikimedia Commons",
      pageId: page.pageid,
      pageUrl: commonsPageUrl(page.title),
      revisionId: page.lastrevid,
      revisionTimestamp: revision.timestamp,
      checksumSha256: sha256(stableJson(page)),
      metadataLicense: "CC0-1.0",
    },
    original: {
      url: externalUrl(info.url),
      mime: info.mime,
      width: info.width,
      height: info.height,
      bytes: info.size,
      sha1: info.sha1,
    },
    derivative: {
      localPath: `/${portrait.downloadPath}`,
      sourceUrl,
      mime: optimized.mime,
      width: optimized.width,
      height: optimized.height,
      bytes: optimized.body.length,
      sha256: sha256(optimized.body),
      modification: `Locally auto-oriented, metadata-stripped, resized without enlargement to at most ${optimized.targetWidth}px wide, and encoded as WebP quality ${optimized.quality}`,
    },
    rights: {
      licenseShortName,
      licenseUrl: externalUrl(metadataValue(info, "LicenseUrl")),
      usageTerms,
      attributionRequired: !["false", "0", "no"].includes(String(metadataValue(info, "AttributionRequired") ?? "true").toLowerCase()),
      artist,
      credit: plainMetadata(metadataValue(info, "Credit")),
    },
  };
}

async function fetchCommonsEntry(entry, client) {
  const portrait = entry.portrait;
  if (!portrait) return null;
  const url = apiUrl(COMMONS_ENDPOINT, {
    action: "query",
    prop: "info|imageinfo|revisions",
    titles: portrait.commonsTitle,
    iiprop: "url|mime|size|sha1|timestamp|user|extmetadata",
    iiurlwidth: portrait.width,
    rvprop: "ids|timestamp",
    rvlimit: 1,
    format: "json",
    formatversion: 2,
    maxlag: 5,
  });
  const response = await client.requestJson(url);
  const page = response.query?.pages?.[0];
  const downloadUrl = externalUrl(page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url);
  if (!downloadUrl) throw new Error(`${entry.id}: Commons download URL is missing`);
  const downloaded = await client.requestBuffer(assertCommonsDownloadUrl(downloadUrl, entry.id));
  const optimized = await optimizePortrait(downloaded.body, portrait.width);
  return { record: normalizeCommonsRecord(entry, page, downloaded, optimized), body: optimized.body, downloadPath: portrait.downloadPath };
}

export function validateWikimediaManifest(manifest) {
  if (manifest.schemaVersion !== 1 || manifest.language !== "en" || !Array.isArray(manifest.people)) {
    throw new Error("Wikimedia manifest must use schemaVersion 1, language en, and a people array");
  }
  const ids = new Set();
  const wikidataIds = new Set();
  const portraitIds = new Set();
  const downloadPaths = new Set();
  for (const entry of manifest.people) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) throw new Error(`Invalid person id ${entry.id}`);
    if (!/^Q[1-9][0-9]*$/.test(entry.wikidataId)) throw new Error(`${entry.id}: invalid Wikidata id`);
    if (ids.has(entry.id) || wikidataIds.has(entry.wikidataId)) throw new Error(`${entry.id}: duplicate person or Wikidata id`);
    ids.add(entry.id);
    wikidataIds.add(entry.wikidataId);
    if (entry.portrait) {
      const portrait = entry.portrait;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(portrait.id)) throw new Error(`${entry.id}: invalid portrait id`);
      if (!String(portrait.commonsTitle).startsWith("File:")) throw new Error(`${entry.id}: commonsTitle must begin File:`);
      if (!/^media\/wikimedia\/[a-z0-9][a-z0-9._-]*\.webp$/.test(portrait.downloadPath) || portrait.downloadPath.includes("..")) {
        throw new Error(`${entry.id}: portrait downloadPath must be a safe .webp path under media/wikimedia/`);
      }
      if (!Number.isInteger(portrait.width) || portrait.width < 320 || portrait.width > MAX_PORTRAIT_WIDTH) throw new Error(`${entry.id}: portrait width must be 320–${MAX_PORTRAIT_WIDTH}`);
      if (portraitIds.has(portrait.id) || downloadPaths.has(portrait.downloadPath)) throw new Error(`${entry.id}: duplicate portrait id or download path`);
      portraitIds.add(portrait.id);
      downloadPaths.add(portrait.downloadPath);
    }
  }
  return manifest;
}

async function atomicWrite(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporary, contents);
  await rename(temporary, filePath);
}

async function fileContents(filePath) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function jsonFiles(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function syncWikimedia({
  projectRoot,
  manifestPath = path.join(projectRoot, "content", "entities", "people", "wikimedia-manifest.json"),
  mode = "check",
  concurrency = MAX_WIKIMEDIA_CONCURRENCY,
  fetchImpl = globalThis.fetch,
  sleepImpl,
  userAgent = process.env.WIKIMEDIA_USER_AGENT || DEFAULT_WIKIMEDIA_USER_AGENT,
} = {}) {
  if (!projectRoot) throw new Error("projectRoot is required");
  if (!["check", "write"].includes(mode)) throw new Error("mode must be check or write");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_WIKIMEDIA_CONCURRENCY) {
    throw new Error(`concurrency must be between 1 and ${MAX_WIKIMEDIA_CONCURRENCY}`);
  }
  const manifest = validateWikimediaManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  const client = createWikimediaClient({ fetchImpl, sleepImpl, userAgent });
  const peopleRecords = await fetchWikidataEntries(manifest, client);
  const commons = await mapWithConcurrency(manifest.people, concurrency, (entry) => fetchCommonsEntry(entry, client));
  const expected = new Map();
  for (const record of peopleRecords) {
    expected.set(path.join(projectRoot, "content", "entities", "people", "wikimedia", `${record.id}.json`), Buffer.from(stableJson(record)));
  }
  for (const result of commons.filter(Boolean)) {
    expected.set(path.join(projectRoot, "content", "media", "wikimedia", `${result.record.id}.json`), Buffer.from(stableJson(result.record)));
    const assetPath = path.resolve(projectRoot, "public", result.downloadPath);
    const relative = path.relative(path.join(projectRoot, "public"), assetPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${result.record.id}: asset path escaped public/`);
    expected.set(assetPath, result.body);
  }

  const differences = [];
  for (const [filePath, contents] of expected) {
    const current = await fileContents(filePath);
    if (!current || !current.equals(contents)) differences.push(path.relative(projectRoot, filePath));
  }
  const expectedGenerated = new Set([...expected.keys()].filter((filePath) => filePath.endsWith(".json")));
  const actualGenerated = [
    ...(await jsonFiles(path.join(projectRoot, "content", "entities", "people", "wikimedia"))),
    ...(await jsonFiles(path.join(projectRoot, "content", "media", "wikimedia"))),
  ];
  for (const filePath of actualGenerated) {
    if (!expectedGenerated.has(filePath)) differences.push(`${path.relative(projectRoot, filePath)} (not in manifest)`);
  }

  if (mode === "check") {
    if (differences.length) throw new Error(`Wikimedia check found ${differences.length} change(s):\n- ${differences.join("\n- ")}`);
  } else {
    for (const [filePath, contents] of expected) {
      const current = await fileContents(filePath);
      if (!current || !current.equals(contents)) await atomicWrite(filePath, contents);
    }
  }
  return {
    people: peopleRecords.length,
    media: commons.filter(Boolean).length,
    changed: differences,
    userAgent: client.userAgent,
  };
}
