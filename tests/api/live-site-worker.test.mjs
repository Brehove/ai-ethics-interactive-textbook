import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker, { injectPublicProjection } from "../../workers/site/src/index.mjs";

const route = { documentId: "chapter_ch07" };
const projection = { documentId: "chapter_ch07", revisionId: "revision_live", projectionId: "projection_live", projectionHash: "a".repeat(64), html: '<p id="ch07-p0001">Live prose.</p>', prompts: [{ checkpointId: "checkpoint_live" }] };
const staticHtml = '<main><div class="chapter-body" data-public-projection="chapter_ch07"><p>Static fallback.</p><section data-inline-scholar-gallery><aside><div>Duplicate fallback thinker.</div></aside></section></div><template data-public-projection-end="chapter_ch07"></template><aside data-reading-record data-document-id="chapter_ch07"></aside></main>';

test("HTML fallback helper injects exact server-side projection and prompts", () => {
  const html = injectPublicProjection(staticHtml, route, projection);
  assert.match(html, /Live prose/);
  assert.doesNotMatch(html, /Static fallback/);
  assert.doesNotMatch(html, /Duplicate fallback thinker/);
  assert.match(html, /checkpoint_live/);
  assert.match(html, /data-chapter-version="revision_live"/);
});

test("HTML fallback refuses an unmarked or malformed nested projection boundary", () => {
  assert.throws(() => injectPublicProjection('<div data-public-projection="chapter_ch07"><div>nested</div></div>', route, projection), /boundary is missing or malformed/);
});

test("site Worker serves verified projection for every allowlisted chapter without direct D1", async () => {
  const env = {
    ASSETS: { fetch: async () => new Response(staticHtml, { headers: { "content-type": "text/html; charset=utf-8" } }) },
    PUBLIC_PROJECTION: { fetch: async (request) => { assert.equal(new URL(request.url).pathname, "/v1/public/chapters/chapter_ch07"); return Response.json(projection); } },
  };
  const response = await worker.fetch(new Request("https://example.test/chapter/aristotle-character-and-ai-assisted-life/"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-revision"), "revision_live");
  assert.equal(response.headers.get("x-content-projection"), "projection_live");
  assert.match(await response.text(), /Live prose/);
});

test("delivery identity probe verifies the deployed chapter asset can render the immutable projection", async () => {
  let assetCalls = 0;
  const env = {
    ASSETS: { fetch: async () => { assetCalls += 1; return new Response(staticHtml, { headers: { "content-type": "text/html; charset=utf-8" } }); } },
    PUBLIC_PROJECTION: { fetch: async (request) => {
      assert.equal(new URL(request.url).pathname, "/v1/public/chapters/chapter_ch07");
      return Response.json(projection);
    } },
  };
  const response = await worker.fetch(new Request("https://example.test/chapter/aristotle-character-and-ai-assisted-life/", {
    headers: { "x-textbook-delivery-probe": "v1" },
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("x-content-revision"), "revision_live");
  assert.equal(response.headers.get("x-content-projection"), "projection_live");
  assert.equal(response.headers.get("x-content-projection-hash"), projection.projectionHash);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "");
  assert.equal(assetCalls, 1);
});

test("delivery identity probe refuses missing or malformed public chapter assets", async () => {
  for (const response of [
    new Response("missing", { status: 404, headers: { "content-type": "text/html" } }),
    new Response("not html", { headers: { "content-type": "text/plain" } }),
    new Response("<main>no projection boundary</main>", { headers: { "content-type": "text/html" } }),
  ]) {
    const result = await worker.fetch(new Request("https://example.test/chapter/aristotle-character-and-ai-assisted-life/", {
      headers: { "x-textbook-delivery-probe": "v1" },
    }), {
      ASSETS: { fetch: async () => response.clone() },
      PUBLIC_PROJECTION: { fetch: async () => Response.json(projection) },
    });
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("x-content-revision"), null);
  }
});

test("projection failure leaves the complete static chapter visible", async () => {
  const env = { ASSETS: { fetch: async () => new Response(staticHtml, { headers: { "content-type": "text/html" } }) }, PUBLIC_PROJECTION: { fetch: async () => new Response("unavailable", { status: 503 }) } };
  const response = await worker.fetch(new Request("https://example.test/chapter/aristotle-character-and-ai-assisted-life/"), env);
  assert.equal(response.headers.get("x-content-revision"), null);
  assert.match(await response.text(), /Static fallback/);
});

test("legacy admin is redirect-only and cannot serve a second writer", async () => {
  let assetCalls = 0;
  const response = await worker.fetch(new Request("https://example.test/admin/"), { ASSETS: { fetch: async () => { assetCalls += 1; return new Response("legacy writer"); } } });
  assert.equal(response.status, 302);
  assert.equal(assetCalls, 0);
  const target = new URL(response.headers.get("location"));
  assert.equal(target.origin, "https://auth.ethicsandai.your-digital-life.org");
  assert.equal(target.pathname, "/auth/start");
  assert.equal(target.searchParams.get("mode"), "edit");
});

test("site Worker proxies immutable public media without touching static assets", async () => {
  const hash = "d".repeat(64);
  let assetCalls = 0;
  const env = {
    ASSETS: { fetch: async () => { assetCalls += 1; return new Response("wrong"); } },
    PUBLIC_PROJECTION: { fetch: async (request) => {
      assert.equal(new URL(request.url).pathname, `/v1/public/assets/${hash}`);
      return new Response("image", { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "x-content-sha256": hash } });
    } },
  };
  const response = await worker.fetch(new Request(`https://example.test/media/${hash}`), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-sha256"), hash);
  assert.equal(await response.text(), "image");
  assert.equal(assetCalls, 0);
});

test("production Site Worker has no D1 binding and uses the internal projection service", async () => {
  const config = JSON.parse(await readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.assets.binding, "ASSETS");
  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.d1_databases, undefined);
  assert.deepEqual(config.services, [{ binding: "PUBLIC_PROJECTION", service: "ai-ethics-public-projection" }]);
});
