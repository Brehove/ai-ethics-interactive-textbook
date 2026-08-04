import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  approveAgentCapabilityRequest,
  createAgentCapabilityRequest,
  exchangeAgentCapabilityRequest,
  revokeAgentCapability,
  verifyIssuedAgentCapability,
} from "../src/capabilities.mjs";
import { signToken } from "../src/crypto.mjs";
import { createEditorAuthApp, createCapabilityVerifier } from "../src/index.mjs";
import { SESSION_COOKIE } from "../src/constants.mjs";

const NOW = 1_785_600_000;
const AUTH_ORIGIN = "https://auth.example.test";
const EDITOR_ORIGIN = "https://editor.example.test";
const SESSION_SECRET = "test-only-session-secret-which-is-longer-than-thirty-two-bytes";
const CAPABILITY_SECRET = "test-only-capability-signing-secret-which-is-longer-than-thirty-two-bytes";

class SqliteD1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
  }

  prepare(sql) {
    return {
      bind: (...values) => {
        const statement = this.db.prepare(sql);
        return {
          first: async () => statement.get(...values) ?? null,
          all: async () => ({ results: statement.all(...values) }),
          run: async () => {
            const result = statement.run(...values);
            return { meta: { changes: Number(result.changes ?? 0), last_row_id: Number(result.lastInsertRowid ?? 0) } };
          },
        };
      },
    };
  }

  async batch(statements) {
    this.db.exec("BEGIN");
    try {
      const result = [];
      for (const statement of statements) result.push(await statement.run());
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close() { this.db.close(); }
}

async function testDb() {
  const db = new SqliteD1();
  db.db.exec(await readFile(new URL("../migrations/0001_auth_state.sql", import.meta.url), "utf8"));
  return db;
}

function randomFactory() {
  let counter = 0;
  return (length) => new Uint8Array(length).fill((counter += 1) & 0xff);
}

function env(db, overrides = {}) {
  return {
    AUTH_STATE_DB: db,
    AGENT_CAPABILITY_SIGNING_SECRET: CAPABILITY_SECRET,
    EDITOR_CAPABILITY_VERIFICATION_URL: `${EDITOR_ORIGIN}/agent-access`,
    EDITOR_REPO_OWNER: "Brehove",
    EDITOR_REPO_NAME: "ai-ethics-interactive-textbook",
    EDITOR_DEFAULT_BRANCH: "main",
    EDITOR_ALLOWED_ORIGINS: EDITOR_ORIGIN,
    EDITOR_AUTH_BASE_URL: AUTH_ORIGIN,
    EDITOR_ADMIN_URL: `${EDITOR_ORIGIN}/edit`,
    EDITOR_ALLOWED_GITHUB_USER_IDS: "123456",
    EDITOR_SESSION_SECRET: SESSION_SECRET,
    EDITOR_STATE_TTL_SECONDS: "600",
    EDITOR_SESSION_TTL_SECONDS: "3600",
    ...overrides,
  };
}

const instructor = (overrides = {}) => ({ sub: "123456", login: "instructor", csrf: "csrf", iat: NOW - 10, stepUpAt: NOW - 10, ...overrides });
const requestInput = (overrides = {}) => ({
  clientId: "codex",
  runId: "run_123",
  allowedDocumentIds: ["chapter_ch07"],
  allowedOperations: ["chapter.replace_document"],
  ...overrides,
});

test("edit-only is the default: it is short-lived, requires approval, and can only be exchanged once", async () => {
  const db = await testDb();
  try {
    const runtime = env(db);
    const randomBytes = randomFactory();
    const requested = await createAgentCapabilityRequest(requestInput(), runtime, NOW, randomBytes);
    const stored = await db.prepare("SELECT scopes_json, requested_lifetime_seconds, state FROM agent_capability_requests WHERE id = ?").bind(requested.requestId).first();
    assert.deepEqual(JSON.parse(stored.scopes_json), ["content:read", "content:write"]);
    assert.equal(stored.requested_lifetime_seconds, 900);
    assert.equal(stored.state, "pending");

    assert.deepEqual(await exchangeAgentCapabilityRequest(requested.requestId, requested.deviceSecret, runtime, NOW, randomBytes), { pending: true, retryAfter: 2 });
    await approveAgentCapabilityRequest(requested.requestId, { approve: true, userCode: requested.userCode }, instructor({ iat: NOW - 800 }), runtime, NOW);
    const exchanged = await exchangeAgentCapabilityRequest(requested.requestId, requested.deviceSecret, runtime, NOW, randomBytes);
    assert.equal(exchanged.tokenType, "Bearer");
    assert.equal(exchanged.claims.scopes.includes("content:live-save"), false);
    await assert.rejects(() => exchangeAgentCapabilityRequest(requested.requestId, requested.deviceSecret, runtime, NOW, randomBytes), { code: "capability_request_inactive" });

    const verified = await verifyIssuedAgentCapability(exchanged.accessToken, { documentId: "chapter_ch07", operation: "chapter.replace_document", scope: "content:write" }, runtime, NOW + 1);
    assert.equal(verified.actorType, "agent");
    await assert.rejects(() => verifyIssuedAgentCapability(exchanged.accessToken, { documentId: "chapter_ch08", scope: "content:write" }, runtime, NOW + 1), { code: "capability_document_forbidden" });
  } finally { db.close(); }
});

test("live Save requires exact chapter + commit_live, explicit confirmation, and a fresh GitHub session", async () => {
  const db = await testDb();
  try {
    const runtime = env(db);
    const randomBytes = randomFactory();
    const requested = await createAgentCapabilityRequest(requestInput({
      scopes: ["content:read", "content:write", "content:live-save"],
      allowedOperations: ["commit_live"],
      lifetimeSeconds: 600,
    }), runtime, NOW, randomBytes);
    await assert.rejects(
      () => approveAgentCapabilityRequest(requested.requestId, { approve: true, confirmLiveSave: true, userCode: requested.userCode }, instructor({ iat: NOW - 301, stepUpAt: NOW - 301 }), runtime, NOW),
      { code: "recent_step_up_required" },
    );
    await assert.rejects(
      () => approveAgentCapabilityRequest(requested.requestId, { approve: true, userCode: requested.userCode }, instructor(), runtime, NOW),
      { code: "live_save_confirmation_required" },
    );
    await assert.rejects(
      () => approveAgentCapabilityRequest(requested.requestId, { approve: true, confirmLiveSave: true, userCode: "WRONG" }, instructor(), runtime, NOW),
      { code: "user_code_invalid" },
    );
    await approveAgentCapabilityRequest(requested.requestId, { approve: true, confirmLiveSave: true, userCode: requested.userCode }, instructor(), runtime, NOW);
    const exchanged = await exchangeAgentCapabilityRequest(requested.requestId, requested.deviceSecret, runtime, NOW, randomBytes);
    assert.equal(exchanged.expiresAt, new Date((NOW + 600) * 1000).toISOString());
    await verifyIssuedAgentCapability(exchanged.accessToken, { documentId: "chapter_ch07", operation: "commit_live", scope: "content:live-save" }, runtime, NOW + 1);
    await assert.rejects(() => verifyIssuedAgentCapability(exchanged.accessToken, { documentId: "chapter_ch07", operation: "chapter.replace_document", scope: "content:write" }, runtime, NOW + 1), { code: "capability_operation_forbidden" });
  } finally { db.close(); }
});

test("issued capability expires and can be revoked by its issuing instructor", async () => {
  const db = await testDb();
  try {
    const runtime = env(db);
    const randomBytes = randomFactory();
    const requested = await createAgentCapabilityRequest(requestInput({ lifetimeSeconds: 60 }), runtime, NOW, randomBytes);
    await approveAgentCapabilityRequest(requested.requestId, { approve: true, userCode: requested.userCode }, instructor(), runtime, NOW);
    const exchanged = await exchangeAgentCapabilityRequest(requested.requestId, requested.deviceSecret, runtime, NOW, randomBytes);
    await revokeAgentCapability(exchanged.jti, "Stop this run", instructor(), runtime, NOW + 1);
    await assert.rejects(() => verifyIssuedAgentCapability(exchanged.accessToken, { scope: "content:read" }, runtime, NOW + 2), { code: "invalid_capability" });
    await assert.rejects(() => verifyIssuedAgentCapability(exchanged.accessToken, { scope: "content:read" }, runtime, NOW + 61), { code: "invalid_capability" });
  } finally { db.close(); }
});

test("HTTP device flow uses session + CSRF only for approval, and exposes no HTTP verifier", async () => {
  const db = await testDb();
  try {
    const runtime = env(db);
    const app = createEditorAuthApp({ now: () => NOW, randomBytes: randomFactory() });
    const created = await app.fetch(new Request(`${AUTH_ORIGIN}/auth/agent-capability-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestInput()),
    }), runtime);
    assert.equal(created.status, 201);
    const request = await created.json();
    const session = await signToken({ v: 1, kind: "session", sub: "123456", login: "instructor", csrf: "csrf", iat: NOW - 10, stepUpAt: NOW - 10, exp: NOW + 900 }, SESSION_SECRET);
    const approved = await app.fetch(new Request(`${AUTH_ORIGIN}/auth/agent-capability-requests/${request.requestId}`, {
      method: "POST",
      headers: { Origin: EDITOR_ORIGIN, Cookie: `${SESSION_COOKIE}=${session}`, "X-Editor-CSRF": "csrf", "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true, userCode: request.userCode }),
    }), runtime);
    assert.equal(approved.status, 200);
    const exchanged = await app.fetch(new Request(`${AUTH_ORIGIN}/auth/agent-capability-requests/${request.requestId}:exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceSecret: request.deviceSecret }),
    }), runtime);
    assert.equal(exchanged.status, 200);
    const token = (await exchanged.json()).accessToken;
    const verifier = createCapabilityVerifier(runtime, { now: () => NOW + 1 });
    assert.equal((await verifier.verifyCapability(token, { scope: "content:read" })).actorType, "agent");
    const internal = await app.fetch(new Request(`${AUTH_ORIGIN}/internal/capabilities:verify`, { method: "POST" }), runtime);
    assert.equal(internal.status, 404);
  } finally { db.close(); }
});
