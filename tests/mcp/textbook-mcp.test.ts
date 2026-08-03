import test from "node:test";
import assert from "node:assert/strict";
import { ContentApiClient, SERVER_INSTRUCTIONS, TOOL_SAFETY, refuseRaw } from "../../packages/textbook-mcp/src/server.ts";

test("Content API client forwards bearer auth without exposing it in the URL", async () => {
  let url = ""; let headers: Headers | undefined;
  const fakeFetch = (async (value: RequestInfo | URL, init?: RequestInit) => { url = String(value); headers = new Headers(init?.headers); return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }); }) as typeof fetch;
  const client = new ContentApiClient({ baseUrl: "https://gateway.example/", bearerToken: "secret-value", fetch: fakeFetch });
  assert.deepEqual(await client.request("/v1/chapters"), { ok: true });
  assert.equal(headers!.get("authorization"), "Bearer secret-value");
  assert.equal(url.includes("secret-value"), false);
});

test("raw patch mutations are refused before reaching the API", () => {
  assert.throws(() => refuseRaw({ html: "<p>unsafe</p>" }), /refused/);
  assert.throws(() => refuseRaw({ databasePatch: "UPDATE documents" }), /refused/);
  assert.doesNotThrow(() => refuseRaw({ type: "checkpoint.upsert" }));
});

test("workflow instructions require draft validation and approval before publish", () => {
  for (const word of ["read", "changeset", "validate", "submit", "approve", "publish"]) assert.match(SERVER_INSTRUCTIONS, new RegExp(word));
  assert.match(SERVER_INSTRUCTIONS, /Never send raw HTML/);
});

test("tool safety annotations reserve destructive open-world flags for release actions", () => {
  assert.equal(TOOL_SAFETY.read.readOnlyHint, true);
  assert.deepEqual(TOOL_SAFETY.mutate, { readOnlyHint: false, destructiveHint: false, openWorldHint: false });
  assert.deepEqual(TOOL_SAFETY.dangerous, { readOnlyHint: false, destructiveHint: true, openWorldHint: true });
});
