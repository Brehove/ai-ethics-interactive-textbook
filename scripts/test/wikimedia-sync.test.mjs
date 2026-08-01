import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createWikimediaClient,
  MAX_PORTRAIT_BYTES,
  MAX_PORTRAIT_WIDTH,
  mapWithConcurrency,
  optimizePortrait,
  parseRetryAfter,
  stableJson,
  syncWikimedia,
} from "../wikimedia-lib.mjs";
import { validateWikimediaLayer } from "../validate-wikimedia.mjs";

const TEST_USER_AGENT = "PHIL123WikimediaTests/1.0 (https://example.edu/contact)";
const IMAGE_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="427"><rect width="640" height="427" fill="#654321"/></svg>',
);

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function wikidataEntity() {
  return {
    id: "Q42",
    type: "item",
    lastrevid: 123,
    modified: "2026-08-01T12:00:00Z",
    labels: { en: { language: "en", value: "Test Philosopher" } },
    descriptions: { en: { language: "en", value: "fixture philosopher" } },
    aliases: { en: [{ language: "en", value: "The Tester" }] },
    claims: {},
    sitelinks: {
      enwiki: {
        site: "enwiki",
        title: "Test Philosopher",
        url: "https://en.wikipedia.org/wiki/Test_Philosopher",
      },
    },
  };
}

function commonsPage(downloadUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/test.jpg/640px-test.jpg") {
  return {
    pageid: 987,
    ns: 6,
    title: "File:Test philosopher.jpg",
    lastrevid: 456,
    revisions: [{ revid: 456, timestamp: "2026-08-01T12:30:00Z" }],
    imageinfo: [{
      timestamp: "2026-08-01T12:30:00Z",
      user: "FixtureUser",
      size: 1000,
      width: 1200,
      height: 800,
      url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/test.jpg",
      descriptionurl: "https://commons.wikimedia.org/wiki/File:Test_philosopher.jpg",
      mime: "image/jpeg",
      sha1: "a".repeat(40),
      thumburl: downloadUrl,
      thumbwidth: 640,
      thumbheight: 427,
      thumbmime: "image/jpeg",
      extmetadata: {
        LicenseShortName: { value: "CC BY 4.0" },
        LicenseUrl: { value: "https://creativecommons.org/licenses/by/4.0/" },
        UsageTerms: { value: "Creative Commons Attribution 4.0" },
        AttributionRequired: { value: "true" },
        Artist: { value: "<b>Fixture Artist</b>" },
        Credit: { value: "Fixture archive" },
      },
    }],
  };
}

function createFetch({ downloadUrl } = {}) {
  const requests = [];
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    requests.push({ url, options });
    if (url.hostname === "www.wikidata.org") {
      return jsonResponse({ entities: { Q42: wikidataEntity() } });
    }
    if (url.hostname === "commons.wikimedia.org") {
      return jsonResponse({ query: { pages: [commonsPage(downloadUrl)] } });
    }
    if (url.hostname === "upload.wikimedia.org") {
      return new Response(IMAGE_BYTES, { status: 200, headers: { "content-type": "image/svg+xml" } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  return { fetchImpl, requests };
}

async function writeFixture(projectRoot) {
  const manifest = {
    schemaVersion: 1,
    language: "en",
    people: [{
      id: "test-philosopher",
      wikidataId: "Q42",
      portrait: {
        id: "test-philosopher-portrait",
        commonsTitle: "File:Test philosopher.jpg",
        downloadPath: "media/wikimedia/test-philosopher.webp",
        width: 640,
      },
    }],
  };
  const humanPerson = {
    schemaVersion: 1,
    id: "test-philosopher",
    displayName: "Test Philosopher",
    sortName: "Philosopher, Test",
    biography: "A human-authored biography that the refresh command must preserve.",
    teaching: {
      whyThisPerson: "A human-authored teaching rationale.",
      traditionIds: [],
      conceptIds: [],
      primarySourceIds: [],
    },
    portraitId: "test-philosopher-portrait",
    links: { sep: null, iep: null, other: [] },
  };
  const humanMedia = {
    schemaVersion: 1,
    id: "test-philosopher-portrait",
    kind: "image",
    title: "Fixture portrait",
    alt: "Human-authored alternative text.",
    caption: "Human-authored caption.",
    teachingUse: "Human-authored teaching guidance.",
    decorative: false,
    rightsReview: {
      status: "approved",
      reviewedAt: "2026-08-01",
      sourceRevisionId: 456,
      notes: "Fixture review.",
    },
  };
  const files = new Map([
    ["content/entities/people/wikimedia-manifest.json", stableJson(manifest)],
    ["content/entities/people/records/test-philosopher.json", `${JSON.stringify(humanPerson)}\n`],
    ["content/media/records/test-philosopher-portrait.json", `${JSON.stringify(humanMedia)}\n`],
    ["content/chapters/test/source-links.json", stableJson({
      schemaVersion: 1,
      chapterId: "test",
      license: "CC0-1.0",
      primarySources: [],
      companionSources: [],
    })],
  ]);
  for (const [relativePath, contents] of files) {
    const filePath = path.join(projectRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }
  return files;
}

test("Retry-After supports seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter("2"), 2000);
  assert.equal(parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT", Date.parse("Wed, 21 Oct 2015 07:27:58 GMT")), 2000);
  assert.equal(parseRetryAfter("nonsense"), null);
});

test("the Wikimedia client identifies itself and honors Retry-After", async () => {
  const sleeps = [];
  const requests = [];
  const client = createWikimediaClient({
    userAgent: TEST_USER_AGENT,
    sleepImpl: async (milliseconds) => sleeps.push(milliseconds),
    fetchImpl: async (_url, options) => {
      requests.push(options);
      return requests.length === 1
        ? jsonResponse({}, { status: 429, headers: { "retry-after": "2" } })
        : jsonResponse({ ok: true });
    },
  });
  assert.deepEqual(await client.requestJson("https://www.wikidata.org/w/api.php"), { ok: true });
  assert.deepEqual(sleeps, [2000]);
  assert.equal(requests[0].headers["User-Agent"], TEST_USER_AGENT);
  assert.equal(requests[0].headers["Api-User-Agent"], TEST_USER_AGENT);
});

test("concurrency is capped at three and result order remains deterministic", async () => {
  let active = 0;
  let maximum = 0;
  const output = await mapWithConcurrency([5, 4, 3, 2, 1, 0], 3, async (value) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, value));
    active -= 1;
    return value * 2;
  });
  assert.equal(maximum, 3);
  assert.deepEqual(output, [10, 8, 6, 4, 2, 0]);
  await assert.rejects(() => mapWithConcurrency([1], 4, async (value) => value), /1 to 3/);
});

test("portrait optimization produces bounded WebP dimensions and bytes", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#654321"/></svg>');
  const result = await optimizePortrait(svg, 800);
  assert.equal(result.mime, "image/webp");
  assert.equal(result.width, MAX_PORTRAIT_WIDTH);
  assert.equal(result.height, 360);
  assert.ok(result.body.length <= MAX_PORTRAIT_BYTES);
  assert.equal(result.quality, 82);
});

test("refresh writes only machine-owned files, validates offline, and check detects drift", async (t) => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "phil123-wikimedia-"));
  t.after(() => rm(projectRoot, { recursive: true, force: true }));
  const humanFiles = await writeFixture(projectRoot);
  const before = new Map();
  for (const relativePath of humanFiles.keys()) {
    if (relativePath.includes("/records/")) before.set(relativePath, await readFile(path.join(projectRoot, relativePath)));
  }
  const { fetchImpl, requests } = createFetch();
  const written = await syncWikimedia({
    projectRoot,
    mode: "write",
    fetchImpl,
    userAgent: TEST_USER_AGENT,
  });
  assert.equal(written.people, 1);
  assert.equal(written.media, 1);
  assert.deepEqual(written.changed.sort(), [
    "content/entities/people/wikimedia/test-philosopher.json",
    "content/media/wikimedia/test-philosopher-portrait.json",
    "public/media/wikimedia/test-philosopher.webp",
  ]);
  assert.ok(requests.every(({ options }) => options.headers["User-Agent"] === TEST_USER_AGENT));
  for (const [relativePath, contents] of before) {
    assert.deepEqual(await readFile(path.join(projectRoot, relativePath)), contents, `${relativePath} was overwritten`);
  }
  assert.deepEqual(await validateWikimediaLayer({ projectRoot }), { people: 1, media: 1, assets: 1 });
  const sourceLinksPath = path.join(projectRoot, "content/chapters/test/source-links.json");
  await writeFile(sourceLinksPath, stableJson({
    schemaVersion: 1,
    chapterId: "test",
    license: "CC0-1.0",
    primarySources: [{ id: "orphan-source", authorPersonId: "test-philosopher" }],
    companionSources: [],
  }));
  await assert.rejects(
    () => validateWikimediaLayer({ projectRoot }),
    /does not declare this primarySourceId/,
  );
  await writeFile(sourceLinksPath, stableJson({
    schemaVersion: 1,
    chapterId: "test",
    license: "CC0-1.0",
    primarySources: [],
    companionSources: [],
  }));
  await syncWikimedia({ projectRoot, mode: "check", fetchImpl: createFetch().fetchImpl, userAgent: TEST_USER_AGENT });

  const generatedPersonPath = path.join(projectRoot, "content/entities/people/wikimedia/test-philosopher.json");
  await writeFile(generatedPersonPath, `${await readFile(generatedPersonPath, "utf8")} `);
  await assert.rejects(
    () => syncWikimedia({ projectRoot, mode: "check", fetchImpl: createFetch().fetchImpl, userAgent: TEST_USER_AGENT }),
    /Wikimedia check found 1 change/,
  );
});

test("refresh refuses a Commons response that redirects the download lane off Wikimedia", async (t) => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "phil123-wikimedia-host-"));
  t.after(() => rm(projectRoot, { recursive: true, force: true }));
  await writeFixture(projectRoot);
  const { fetchImpl } = createFetch({ downloadUrl: "https://example.com/untrusted.jpg" });
  await assert.rejects(
    () => syncWikimedia({ projectRoot, mode: "write", fetchImpl, userAgent: TEST_USER_AGENT }),
    /refused non-HTTPS or non-Wikimedia download host example.com/,
  );
});
