import assert from "node:assert/strict";
import test from "node:test";
import { AuthoringApiError, createAuthoringClient } from "../../packages/authoring-client/src/index.mjs";

test("browser client preserves cookie auth, CSRF, no-store, and one-call live commit", async () => {
  const calls = [];
  const client = createAuthoringClient({
    baseUrl: "https://content.example/",
    getCsrf: () => "csrf-token",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ commandId: "commit_1", delivery: "verified" }, { status: 201 });
    },
  });
  await client.commitLive({ changeSetId: "changeset_1", documentId: "chapter_ch07", baseRevisionId: "revision_1", expectedVersion: 2, idempotencyKey: crypto.randomUUID(), operations: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://content.example/v1/changesets/changeset_1:commitLive");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.headers["x-editor-csrf"], "csrf-token");
});

test("browser client creates or resumes one chapter changeset and applies an atomic operation batch", async () => {
  const calls = [];
  const client = createAuthoringClient({ baseUrl: "https://content.example", getCsrf: () => "csrf", fetch: async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ id: "changeset_1", resumed: true }); } });
  await client.createOrResumeChangeset("chapter_ch07", { title: "Edit chapter 7", resume: true, idempotencyKey: crypto.randomUUID() });
  await client.applyOperationBatch("changeset_1", { baseRevisionId: "revision_1", expectedVersion: 1, idempotencyKey: crypto.randomUUID(), operations: [{ type: "text.replace", blockId: "block_1", text: "New" }] });
  assert.deepEqual(calls.map((call) => call.url), [
    "https://content.example/v1/chapters/chapter_ch07/changesets",
    "https://content.example/v1/changesets/changeset_1/operations:batch",
  ]);
  assert.equal(calls.every((call) => call.init.headers["x-editor-csrf"] === "csrf"), true);
});

test("agent client forwards the original bearer and validates path segments", async () => {
  let authorization;
  const client = createAuthoringClient({ baseUrl: "https://content.example", getBearer: () => "original-capability", fetch: async (_url, init) => { authorization = init.headers.authorization; return Response.json({ title: "Chapter" }); } });
  await client.getAuthoringView("chapter_ch07");
  assert.equal(authorization, "Bearer original-capability");
  await assert.rejects(async () => client.getAuthoringView("../../admin"), /documentId is invalid/);
});

test("curated person catalog supports bounded search and exact immutable reads", async () => {
  const calls = [];
  const client = createAuthoringClient({ baseUrl: "https://content.example", fetch: async (url) => { calls.push(String(url)); return Response.json({ persons: [] }); } });
  await client.searchPersons({ q: "Aquinas", limit: 25 });
  await client.getPerson("thomas-aquinas");
  assert.deepEqual(calls, ["https://content.example/v1/persons?q=Aquinas&limit=25", "https://content.example/v1/persons/thomas-aquinas"]);
  await assert.rejects(async () => client.getPerson("../unsafe"), /personId is invalid/);
});

test("managed-media previews use an authenticated exact version-and-rights route", () => {
  const client = createAuthoringClient({ baseUrl: "https://auth.example/", fetch: async () => Response.json({}) });
  assert.equal(
    client.getManagedMediaPreviewUrl("media_aquinas", "version_1", "rights_cleared_1"),
    "https://auth.example/v1/media/media_aquinas/versions/version_1/rights/rights_cleared_1:preview",
  );
  assert.throws(() => client.getManagedMediaPreviewUrl("../unsafe", "version_1", "rights_cleared_1"), /mediaId is invalid/);
});

test("typed API errors retain status, code, and details", async () => {
  const client = createAuthoringClient({ baseUrl: "https://content.example", fetch: async () => Response.json({ error: { code: "REVISION_CONFLICT", message: "Stale", details: { current: "revision_2" } } }, { status: 409 }) });
  await assert.rejects(() => client.getLiveCommitStatus("commit_1"), (error) => error instanceof AuthoringApiError && error.status === 409 && error.code === "REVISION_CONFLICT" && error.details.current === "revision_2");
});
