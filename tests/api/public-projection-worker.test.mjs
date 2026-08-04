import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker, { PUBLIC_ASSET_QUERY, PUBLIC_FLAG_QUERY, PUBLIC_PROJECTION_QUERY } from "../../workers/public-projection/src/index.mjs";

const row = {
  document_id: "chapter_ch07",
  revision_id: "revision_live",
  projection_id: "projection_live",
  projection_hash: "a".repeat(64),
  stylesheet_version: "chapter-renderer-v1",
  updated_at: "2026-08-03T00:00:00Z",
  slug: "what-are-you-becoming",
  title: "What Are You Becoming?",
  html: '<p id="ch07-p0001">Live prose.</p>',
  prompts_json: JSON.stringify([{ checkpointId: "checkpoint_1" }]),
};

const env = (result = row) => ({ PUBLIC_CONTENT_DB: { prepare(sql) { assert.equal(sql, PUBLIC_PROJECTION_QUERY); return { bind(id) { assert.equal(id, "chapter_ch07"); return { first: async () => result }; } }; } } });

test("service-bound projection Worker exposes one bounded read route", async () => {
  const response = await worker.fetch(new Request("https://projection.internal/v1/public/chapters/chapter_ch07"), env());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-revision"), "revision_live");
  assert.equal(response.headers.get("x-content-projection"), "projection_live");
  assert.equal((await response.json()).prompts[0].checkpointId, "checkpoint_1");
  assert.equal((await worker.fetch(new Request("https://projection.internal/v1/public/chapters/chapter_ch99"), env())).status, 404);
  assert.equal((await worker.fetch(new Request("https://projection.internal/v1/public/chapters/chapter_ch07", { method: "POST" }), env())).status, 404);
});

test("projection Worker fails closed for invalid persisted JSON", async () => {
  const response = await worker.fetch(new Request("https://projection.internal/v1/public/chapters/chapter_ch07"), env({ ...row, prompts_json: "{" }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "PROJECTION_INVALID");
});

test("projection feature flag is a public-table, document-specific fail-closed gate", async () => {
  const flagged = { PUBLIC_CONTENT_DB: { prepare(sql) { return { bind(value) { return { first: async () => sql === PUBLIC_FLAG_QUERY ? { enabled: 0, document_ids_json: '[\"chapter_ch07\"]', version: 1 } : row }; } }; } }, RUNTIME_FLAGS_ENFORCED: "1" };
  const response = await worker.fetch(new Request("https://projection.internal/v1/public/chapters/chapter_ch07"), flagged);
  assert.equal(response.status, 404);
});

test("public media is hash-addressed, allowlisted in D1, and streamed from R2", async () => {
  const hash = "b".repeat(64);
  const bytes = new TextEncoder().encode("published image");
  const mediaEnv = {
    PUBLIC_CONTENT_DB: { prepare(sql) { assert.equal(sql, PUBLIC_ASSET_QUERY); return { bind(value) { assert.equal(value, hash); return { first: async () => ({ sha256: hash, object_key: `media/${hash}.webp`, bytes: bytes.byteLength, mime_type: "image/webp" }) }; } }; } },
    PUBLIC_MEDIA: { get: async (key) => ({ body: bytes, size: bytes.byteLength, customMetadata: { sha256: hash }, writeHttpMetadata() {} }) },
  };
  const response = await worker.fetch(new Request(`https://projection.internal/v1/public/assets/${hash}`), mediaEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-sha256"), hash);
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(await response.text(), "published image");
  const head = await worker.fetch(new Request(`https://projection.internal/v1/public/assets/${hash}`, { method: "HEAD" }), mediaEnv);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("public media fails closed when bytes do not match immutable metadata", async () => {
  const hash = "c".repeat(64);
  const bad = {
    PUBLIC_CONTENT_DB: { prepare() { return { bind() { return { first: async () => ({ sha256: hash, object_key: `media/${hash}.webp`, bytes: 10, mime_type: "image/webp" }) }; } }; } },
    PUBLIC_MEDIA: { get: async () => ({ body: new Uint8Array(2), size: 2, customMetadata: { sha256: hash }, writeHttpMetadata() {} }) },
  };
  assert.equal((await worker.fetch(new Request(`https://projection.internal/v1/public/assets/${hash}`), bad)).status, 503);
  assert.equal((await worker.fetch(new Request("https://projection.internal/v1/public/assets/not-a-hash"), bad)).status, 404);
});

test("deployment is service-binding-only and the query is public-table allowlisted", async () => {
  const config = JSON.parse(await readFile(new URL("../../workers/public-projection/wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.routes, undefined);
  assert.deepEqual(config.r2_buckets, [{ binding: "PUBLIC_MEDIA", bucket_name: "ai-ethics-content-media" }]);
  assert.deepEqual([...PUBLIC_PROJECTION_QUERY.matchAll(/(?:FROM|JOIN)\s+([a-z_]+)/gi)].map((match) => match[1]), ["public_chapter_heads", "public_chapter_projections"]);
  assert.deepEqual([...PUBLIC_ASSET_QUERY.matchAll(/(?:FROM|JOIN)\s+([a-z_]+)/gi)].map((match) => match[1]), ["public_media_assets"]);
  assert.deepEqual([...PUBLIC_FLAG_QUERY.matchAll(/(?:FROM|JOIN)\s+([a-z_]+)/gi)].map((match) => match[1]), ["public_runtime_feature_flags"]);
  assert.doesNotMatch(PUBLIC_PROJECTION_QUERY, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i);
});
