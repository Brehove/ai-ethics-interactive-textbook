import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { SESSION_COOKIE } from "../src/constants.mjs";
import { signToken } from "../src/crypto.mjs";
import { createCapabilityVerifier, createEditorAuthApp } from "../src/index.mjs";
import { pkceChallenge } from "../src/oauth-state.mjs";

const NOW = 1_785_600_000;
const AUTH_ORIGIN = "https://auth.example.test";
const EDITOR_ORIGIN = "https://editor.example.test";
const RESOURCE = "https://mcp.ethicsandai.your-digital-life.org/mcp";
const CLIENT_ID = "codex-ai-ethics-textbook";
const REDIRECT_URI = "http://127.0.0.1:43123/callback/ai-ethics-textbook";
const SESSION_SECRET = "test-only-session-secret-which-is-longer-than-thirty-two-bytes";
const CAPABILITY_SECRET = "test-only-capability-signing-secret-which-is-longer-than-thirty-two-bytes";

class SqliteD1 {
  constructor() { this.db = new DatabaseSync(":memory:"); }
  prepare(sql) {
    return { bind: (...values) => {
      const statement = this.db.prepare(sql);
      return {
        first: async () => statement.get(...values) ?? null,
        all: async () => ({ results: statement.all(...values) }),
        run: async () => { const result = statement.run(...values); return { meta: { changes: Number(result.changes ?? 0) } }; },
      };
    } };
  }
  async batch(statements) {
    this.db.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); this.db.exec("COMMIT"); return results; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  close() { this.db.close(); }
}

async function testDb() {
  const db = new SqliteD1();
  for (const name of ["0001_auth_state.sql", "0002_oauth_pkce_states.sql", "0003_mcp_oauth.sql"]) db.db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return db;
}

function randomFactory() {
  let counter = 10;
  return (length) => new Uint8Array(length).fill((counter += 1) & 0xff);
}

function env(db) {
  return {
    AUTH_STATE_DB: db,
    AGENT_CAPABILITY_SIGNING_SECRET: CAPABILITY_SECRET,
    EDITOR_REPO_OWNER: "Brehove",
    EDITOR_REPO_NAME: "ai-ethics-interactive-textbook",
    EDITOR_DEFAULT_BRANCH: "main",
    EDITOR_ALLOWED_ORIGINS: EDITOR_ORIGIN,
    EDITOR_AUTH_BASE_URL: AUTH_ORIGIN,
    EDITOR_ADMIN_URL: EDITOR_ORIGIN,
    EDITOR_ALLOWED_GITHUB_USER_IDS: "123456",
    EDITOR_SESSION_SECRET: SESSION_SECRET,
    EDITOR_STATE_TTL_SECONDS: "600",
    EDITOR_SESSION_TTL_SECONDS: "3600",
  };
}

async function session() {
  return signToken({ v: 1, kind: "session", sub: "123456", login: "instructor", csrf: "csrf-token", iat: NOW - 10, stepUpAt: NOW - 10, exp: NOW + 1800 }, SESSION_SECRET);
}

const form = (values) => new URLSearchParams(values).toString();

test("Codex OAuth discovery, PKCE exchange, refresh rotation, and revocation work end to end", async () => {
  const db = await testDb();
  try {
    const runtime = env(db); const app = createEditorAuthApp({ now: () => NOW, randomBytes: randomFactory() }); const cookie = await session();
    const metadata = await app.fetch(new Request(`${AUTH_ORIGIN}/.well-known/oauth-authorization-server`), runtime);
    assert.equal(metadata.status, 200);
    const metadataBody = await metadata.json();
    assert.equal(metadataBody.token_endpoint, `${AUTH_ORIGIN}/oauth/token`);
    assert.equal(metadataBody.registration_endpoint, `${AUTH_ORIGIN}/oauth/register`);
    assert.equal(metadataBody.scopes_supported.includes("content:live-save"), true);
    const registered = await app.fetch(new Request(`${AUTH_ORIGIN}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "Codex", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
    }), runtime);
    assert.equal(registered.status, 201);
    const client = await registered.json();
    assert.equal(client.client_id, CLIENT_ID);

    const verifier = "v".repeat(64); const challenge = await pkceChallenge(verifier); const state = "state_123456789";
    const authorize = new URL(`${AUTH_ORIGIN}/oauth/authorize`);
    for (const [key, value] of Object.entries({ client_id: client.client_id, response_type: "code", redirect_uri: REDIRECT_URI, resource: RESOURCE, state, code_challenge: challenge, code_challenge_method: "S256", scope: "content:read content:write content:live-save media:read media:upload" })) authorize.searchParams.set(key, value);
    const consent = await app.fetch(new Request(authorize, { headers: { Cookie: `${SESSION_COOKIE}=${cookie}` } }), runtime);
    assert.equal(consent.status, 200);
    const consentHtml = await consent.text(); const requestId = consentHtml.match(/name="request" value="([^"]+)"/)?.[1];
    assert.match(requestId, /^oauthreq_/);
    assert.match(consentHtml, /trusted chapter editing and publishing access/);
    assert.match(consentHtml, /only when you explicitly ask it to save or publish/);

    const approved = await app.fetch(new Request(`${AUTH_ORIGIN}/oauth/authorize`, { method: "POST", headers: { Cookie: `${SESSION_COOKIE}=${cookie}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form({ request: requestId, csrf: "csrf-token" }) }), runtime);
    assert.equal(approved.status, 200);
    const approvedHtml = await approved.text();
    assert.match(approvedHtml, /Textbook access approved/);
    const callback = new URL(approvedHtml.match(/href="([^"]+)"/)?.[1].replaceAll("&amp;", "&"));
    assert.equal(callback.origin, "http://127.0.0.1:43123"); assert.equal(callback.searchParams.get("state"), state);
    const retriedApproval = await app.fetch(new Request(`${AUTH_ORIGIN}/oauth/authorize`, { method: "POST", headers: { Cookie: `${SESSION_COOKIE}=${cookie}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form({ request: requestId, csrf: "csrf-token" }) }), runtime);
    assert.equal(retriedApproval.status, 200);
    assert.equal(await retriedApproval.text(), approvedHtml);

    const exchanged = await app.fetch(new Request(`${AUTH_ORIGIN}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "authorization_code", client_id: client.client_id, redirect_uri: REDIRECT_URI, resource: RESOURCE, code: callback.searchParams.get("code"), code_verifier: verifier }) }), runtime);
    assert.equal(exchanged.status, 200);
    const first = await exchanged.json(); assert.equal(first.token_type, "Bearer"); assert.ok(first.refresh_token);
    const identity = await createCapabilityVerifier(runtime, { now: () => NOW + 1 }).verifyCapability(first.access_token, { documentId: "chapter_ch07", operation: "upsert_checkpoint", scope: "content:write" });
    assert.equal(identity.actorId, "actor_github_123456");
    assert.equal(identity.scopes.includes("content:live-save"), true);
    assert.equal(identity.allowedOperations.includes("commit_live"), true);
    const liveIdentity = await createCapabilityVerifier(runtime, { now: () => NOW + 1 }).verifyCapability(first.access_token, { documentId: "chapter_ch07", operation: "commit_live", scope: "content:live-save" });
    assert.equal(liveIdentity.actorId, "actor_github_123456");

    const refreshed = await app.fetch(new Request(`${AUTH_ORIGIN}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "refresh_token", client_id: client.client_id, resource: RESOURCE, refresh_token: first.refresh_token }) }), runtime);
    assert.equal(refreshed.status, 200); const second = await refreshed.json(); assert.notEqual(second.refresh_token, first.refresh_token);
    await assert.rejects(() => createCapabilityVerifier(runtime, { now: () => NOW + 1 }).verifyCapability(first.access_token, { scope: "content:read" }), { code: "invalid_capability" });

    const revoked = await app.fetch(new Request(`${AUTH_ORIGIN}/oauth/revoke`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ token: second.refresh_token, client_id: client.client_id }) }), runtime);
    assert.equal(revoked.status, 200);
    await assert.rejects(() => createCapabilityVerifier(runtime, { now: () => NOW + 1 }).verifyCapability(second.access_token, { scope: "content:read" }), { code: "invalid_capability" });
  } finally { db.close(); }
});

test("OAuth rejects non-loopback redirects, missing PKCE, invalid Live Save combinations, and unknown scopes", async () => {
  const db = await testDb();
  try {
    const runtime = env(db); const app = createEditorAuthApp({ now: () => NOW, randomBytes: randomFactory() }); const cookie = await session();
    for (const overrides of [
      { redirect_uri: "https://attacker.example/callback" },
      { code_challenge: "missing" },
      { scope: "content:read content:live-save" },
      { scope: "content:read content:admin" },
    ]) {
      const authorize = new URL(`${AUTH_ORIGIN}/oauth/authorize`);
      const values = { client_id: CLIENT_ID, response_type: "code", redirect_uri: REDIRECT_URI, resource: RESOURCE, state: "state_123456789", code_challenge: await pkceChallenge("v".repeat(64)), code_challenge_method: "S256", scope: "content:read", ...overrides };
      for (const [key, value] of Object.entries(values)) authorize.searchParams.set(key, value);
      const response = await app.fetch(new Request(authorize, { headers: { Cookie: `${SESSION_COOKIE}=${cookie}` } }), runtime);
      assert.equal(response.status, 400);
    }
  } finally { db.close(); }
});
