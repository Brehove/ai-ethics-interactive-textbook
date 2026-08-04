import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../../apps/instructor-editor/src/worker.mjs";

test("editor host serves deep chapter links through the SPA with strict security headers", async () => {
  const calls = [];
  const env = { ASSETS: { fetch: async (request) => {
    const path = new URL(request.url).pathname; calls.push(path);
    return path === "/index.html" ? new Response("<main>Editor</main>", { headers: { "content-type": "text/html" } }) : new Response("missing", { status: 404 });
  } } };
  const response = await worker.fetch(new Request("https://editor.example/chapter/aristotle-character-and-ai-assisted-life/#ch07-p0014"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/chapter/aristotle-character-and-ai-assisted-life/", "/index.html"]);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("editor deployment has assets only and no database, bucket, queue, or service binding", async () => {
  const config = JSON.parse(await readFile(new URL("../../apps/instructor-editor/wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.assets.binding, "ASSETS");
  for (const key of ["d1_databases", "r2_buckets", "queues", "services", "durable_objects", "kv_namespaces"]) assert.equal(config[key], undefined);
  assert.equal(config.routes[0].pattern, "editor.ethicsandai.your-digital-life.org");
});
