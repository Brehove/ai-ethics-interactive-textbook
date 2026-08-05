import { constantTimeEqual, randomBase64Url, signToken, verifyToken } from "./crypto.mjs";
import { HttpError } from "./policy.mjs";
import { verifyMcpOAuthAccessToken } from "./mcp-oauth.mjs";

const encoder = new TextEncoder();
const ALLOWED_SCOPES = new Set(["content:read", "content:write", "content:submit", "content:live-save", "media:read", "media:upload"]);
const DOCUMENT = /^chapter_ch(?:0[1-9]|1[0-8])$/;
const OPERATION = /^[a-z][a-z0-9_.:-]{0,79}$/;
const CLIENT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
};

export async function capabilityHash(value) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(typeof value === "string" ? value : JSON.stringify(stable(value))));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const authDb = (env) => {
  if (!env.AUTH_STATE_DB?.prepare) throw new HttpError(503, "capability_unavailable", "Capability state is unavailable");
  return env.AUTH_STATE_DB;
};
const signingSecret = (env) => {
  const secret = env.AGENT_CAPABILITY_SIGNING_SECRET;
  if (typeof secret !== "string" || encoder.encode(secret).byteLength < 32) throw new HttpError(503, "capability_unavailable", "Capability signing is unavailable");
  return secret;
};
const iso = (epochSeconds) => new Date(epochSeconds * 1000).toISOString();
const parseJson = (value, fallback = []) => { try { return JSON.parse(value); } catch { return fallback; } };
const uniqueSorted = (values, predicate, name, max = 50) => {
  if (!Array.isArray(values) || values.length > max || values.some((value) => typeof value !== "string" || !predicate(value))) throw new HttpError(422, "capability_request_invalid", `${name} is invalid`);
  return [...new Set(values)].sort();
};
const audit = (env, event, subject, actor, detail, at) => env.AUTH_STATE_DB.prepare("INSERT INTO agent_capability_audit (event_kind, subject_id, actor_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?)").bind(event, subject, actor || null, JSON.stringify(detail || {}), at);
const exactLiveSaveTarget = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(422, "live_save_request_invalid", "Live Save target is required");
  const target = {
    changeSetId: typeof input.changeSetId === "string" && OPERATION.test(input.changeSetId) ? input.changeSetId : null,
    documentId: typeof input.documentId === "string" && DOCUMENT.test(input.documentId) ? input.documentId : null,
    baseRevisionId: typeof input.baseRevisionId === "string" && OPERATION.test(input.baseRevisionId) ? input.baseRevisionId : null,
    expectedVersion: Number.isInteger(input.expectedVersion) && input.expectedVersion > 0 ? input.expectedVersion : null,
    idempotencyKey: typeof input.idempotencyKey === "string" && UUID.test(input.idempotencyKey) ? input.idempotencyKey : null,
  };
  if (Object.values(target).some((value) => value === null)) throw new HttpError(422, "live_save_request_invalid", "Live Save target is invalid");
  return Object.freeze(target);
};

export async function createAgentCapabilityRequest(input, env, nowSeconds = Math.floor(Date.now() / 1000), randomBytes) {
  const db = authDb(env);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "invalid_json", "Capability request must be an object");
  const clientId = typeof input.clientId === "string" && CLIENT.test(input.clientId) ? input.clientId : null;
  const runId = typeof input.runId === "string" && CLIENT.test(input.runId) ? input.runId : null;
  if (!clientId || !runId) throw new HttpError(422, "capability_request_invalid", "clientId and runId are required");
  // A capability request is deliberately edit-only unless a caller asks for
  // the separately-confirmed `content:live-save` privilege.  The launcher
  // can therefore omit scopes for the safe, useful default.
  const scopes = uniqueSorted(input.scopes ?? ["content:read", "content:write"], (value) => ALLOWED_SCOPES.has(value), "scopes", 10);
  if (!scopes.includes("content:read")) throw new HttpError(422, "capability_request_invalid", "content:read is required");
  const documents = uniqueSorted(input.allowedDocumentIds ?? [], (value) => DOCUMENT.test(value), "allowedDocumentIds", 18);
  const operations = uniqueSorted(input.allowedOperations ?? [], (value) => OPERATION.test(value), "allowedOperations", 50);
  const liveSave = scopes.includes("content:live-save");
  if (liveSave && (!scopes.includes("content:write") || documents.length === 0 || !operations.includes("commit_live"))) throw new HttpError(422, "capability_request_invalid", "Live Save requires content:write, an exact chapter allowlist, and commit_live");
  const requestedLifetime = Number(input.lifetimeSeconds ?? (liveSave ? 600 : 900));
  const maximum = liveSave ? 600 : 900;
  if (!Number.isInteger(requestedLifetime) || requestedLifetime < 60 || requestedLifetime > maximum) throw new HttpError(422, "capability_request_invalid", `lifetimeSeconds must be 60-${maximum}`);
  const requestId = `capreq_${randomBase64Url(16, randomBytes)}`;
  const deviceSecret = randomBase64Url(32, randomBytes);
  const userCode = randomBase64Url(6, randomBytes).slice(0, 8).toUpperCase();
  const requestedAt = iso(nowSeconds); const expiresAt = iso(nowSeconds + 300);
  await db.batch([
    db.prepare(`INSERT INTO agent_capability_requests (id, device_secret_hash, user_code_hash, client_id, run_id, scopes_json, allowed_document_ids_json, allowed_operations_json, requested_lifetime_seconds, state, requested_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`).bind(requestId, await capabilityHash(deviceSecret), await capabilityHash(userCode), clientId, runId, JSON.stringify(scopes), JSON.stringify(documents), JSON.stringify(operations), requestedLifetime, requestedAt, expiresAt),
    audit(env, "request.created", requestId, null, { clientId, runId, scopes, documents, operations, liveSave }, requestedAt),
  ]);
  const base = new URL(env.EDITOR_CAPABILITY_VERIFICATION_URL || env.EDITOR_ADMIN_URL || "https://editor.ethicsandai.your-digital-life.org/agent-access");
  // The user code is deliberately returned to the launcher only.  Putting it
  // in a URL would leak it to browser history, referrers, and support captures.
  base.searchParams.set("request", requestId);
  return { requestId, deviceSecret, userCode, verificationUrl: base.toString(), expiresAt, pollingIntervalSeconds: 2 };
}

export async function getAgentCapabilityRequest(requestId, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const db = authDb(env);
  const row = await db.prepare(`SELECT id, client_id, run_id, scopes_json, allowed_document_ids_json,
    allowed_operations_json, requested_lifetime_seconds, state, requested_at, expires_at, target_json
    FROM agent_capability_requests WHERE id = ?`).bind(requestId).first();
  if (!row) throw new HttpError(404, "capability_request_not_found", "Capability request was not found");
  const expired = Date.parse(row.expires_at) <= nowSeconds * 1000;
  return Object.freeze({
    requestId: row.id,
    clientId: row.client_id,
    runId: row.run_id,
    scopes: parseJson(row.scopes_json),
    allowedDocumentIds: parseJson(row.allowed_document_ids_json),
    allowedOperations: parseJson(row.allowed_operations_json),
    lifetimeSeconds: row.requested_lifetime_seconds,
    state: expired && row.state === "pending" ? "expired" : row.state,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    liveSave: parseJson(row.scopes_json).includes("content:live-save"),
    ...(row.target_json ? { target: parseJson(row.target_json, null) } : {}),
  });
}

export async function approveAgentCapabilityRequest(requestId, input, session, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const db = authDb(env); const at = iso(nowSeconds);
  const row = await db.prepare("SELECT * FROM agent_capability_requests WHERE id = ?").bind(requestId).first();
  if (!row) throw new HttpError(404, "capability_request_not_found", "Capability request was not found");
  if (row.state !== "pending" || Date.parse(row.expires_at) <= nowSeconds * 1000) throw new HttpError(409, "capability_request_inactive", "Capability request is no longer pending");
  const scopes = parseJson(row.scopes_json); const liveSave = scopes.includes("content:live-save");
  if (input?.approve !== true) throw new HttpError(422, "approval_required", "Explicit approval is required");
  if (typeof input?.userCode !== "string" || !constantTimeEqual(await capabilityHash(input.userCode.trim().toUpperCase()), row.user_code_hash)) {
    throw new HttpError(422, "user_code_invalid", "The capability verification code is invalid");
  }
  if (liveSave && input?.confirmLiveSave !== true) throw new HttpError(422, "live_save_confirmation_required", "Approve live Save explicitly");
  if (liveSave && (!Number.isInteger(session.stepUpAt ?? session.iat) || nowSeconds - (session.stepUpAt ?? session.iat) > 300)) throw new HttpError(403, "recent_step_up_required", "Live Save approval requires GitHub authentication within five minutes");
  const actorId = `actor_github_${String(session.sub).replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const result = await db.prepare("UPDATE agent_capability_requests SET state = 'approved', approved_by = ?, approved_at = ?, live_save_step_up_at = ? WHERE id = ? AND state = 'pending'")
    .bind(actorId, at, liveSave ? iso(session.stepUpAt ?? session.iat) : null, requestId).run();
  if (result?.meta?.changes === 0) throw new HttpError(409, "capability_request_inactive", "Capability request changed while it was being approved");
  await audit(env, "request.approved", requestId, actorId, { liveSave }, at).run();
  return { requestId, approved: true, liveSave };
}

async function issueAgentCapabilityRow(row, env, nowSeconds, randomBytes, actorIdOverride = undefined) {
  const db = authDb(env); const at = iso(nowSeconds);
  const requestId = row.id;
  const scopes = parseJson(row.scopes_json); const documents = parseJson(row.allowed_document_ids_json); const operations = parseJson(row.allowed_operations_json);
  const lifetime = Math.min(row.requested_lifetime_seconds, scopes.includes("content:live-save") ? 120 : 900);
  const jti = `cap_${randomBase64Url(18, randomBytes)}`; const actorId = actorIdOverride || `actor_agent_${row.client_id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const claims = { v: 1, kind: "agent-capability", iss: "ai-ethics-editor-auth", aud: "ai-ethics-textbook-mcp", sub: actorId, actorType: "agent", clientId: row.client_id, runId: row.run_id, scopes, allowedDocumentIds: documents, allowedOperations: operations, iat: nowSeconds, exp: nowSeconds + lifetime, jti };
  const claimsHash = await capabilityHash(claims); const token = await signToken(claims, signingSecret(env));
  const grant = db.prepare(`INSERT INTO agent_capability_grants (jti, actor_id, client_id, run_id, claims_hash, scopes_json, allowed_document_ids_json, allowed_operations_json, issued_at, expires_at, issuance_request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(jti, actorId, row.client_id, row.run_id, claimsHash, row.scopes_json, row.allowed_document_ids_json, row.allowed_operations_json, at, iso(claims.exp), requestId);
  const consume = db.prepare("UPDATE agent_capability_requests SET state = 'consumed', consumed_at = ? WHERE id = ? AND state = 'approved'").bind(at, requestId);
  try {
    await db.batch([grant, consume, audit(env, "grant.issued", jti, actorId, { requestId, expiresAt: iso(claims.exp) }, at)]);
  } catch (error) {
    // The UNIQUE issuance_request_id constraint resolves an exchange race.  Do
    // not surface a database constraint as a retryable 500 to an agent.
    const current = await db.prepare("SELECT state FROM agent_capability_requests WHERE id = ?").bind(requestId).first();
    if (current?.state !== "approved") throw new HttpError(409, "capability_request_inactive", "Capability request cannot be exchanged");
    throw error;
  }
  return { pending: false, accessToken: token, tokenType: "Bearer", expiresAt: iso(claims.exp), jti, claims: { ...claims, kind: undefined, v: undefined } };
}

export async function exchangeAgentCapabilityRequest(requestId, deviceSecret, env, nowSeconds = Math.floor(Date.now() / 1000), randomBytes) {
  const db = authDb(env);
  if (typeof deviceSecret !== "string" || !deviceSecret) throw new HttpError(401, "device_secret_invalid", "Device secret is required");
  const row = await db.prepare("SELECT * FROM agent_capability_requests WHERE id = ? AND device_secret_hash = ?").bind(requestId, await capabilityHash(deviceSecret)).first();
  if (!row) throw new HttpError(401, "device_secret_invalid", "Device secret is invalid");
  if (Date.parse(row.expires_at) <= nowSeconds * 1000) throw new HttpError(410, "capability_request_expired", "Capability request expired");
  if (row.state === "pending") return { pending: true, retryAfter: 2 };
  if (row.state !== "approved") throw new HttpError(409, "capability_request_inactive", "Capability request cannot be exchanged");
  return issueAgentCapabilityRow(row, env, nowSeconds, randomBytes);
}

export async function createBoundLiveSaveRequest(parentToken, input, env, nowSeconds = Math.floor(Date.now() / 1000), randomBytes) {
  const target = exactLiveSaveTarget(input);
  const identity = await verifyIssuedAgentCapability(parentToken, { documentId: target.documentId, operation: "request_live_save_authorization", scope: "content:write" }, env, nowSeconds);
  if (!identity.oauth) throw new HttpError(403, "oauth_required", "Live Save step-up requires a Codex OAuth session");
  const created = await createAgentCapabilityRequest({ clientId: identity.clientId, runId: identity.runId, scopes: ["content:read", "content:write", "content:live-save"], allowedDocumentIds: [target.documentId], allowedOperations: ["commit_live"], lifetimeSeconds: 120 }, env, nowSeconds, randomBytes);
  await authDb(env).prepare("UPDATE agent_capability_requests SET parent_oauth_jti = ?, target_json = ? WHERE id = ?")
    .bind(identity.jti, JSON.stringify(stable(target)), created.requestId).run();
  const verification = new URL("/auth/start", env.EDITOR_AUTH_BASE_URL || "https://auth.ethicsandai.your-digital-life.org");
  verification.searchParams.set("mode", "agent-access");
  verification.searchParams.set("request", created.requestId);
  return { requestId: created.requestId, userCode: created.userCode, verificationUrl: verification.toString(), expiresAt: created.expiresAt, target };
}

export async function consumeBoundLiveSaveRequest(parentToken, requestId, input, env, nowSeconds = Math.floor(Date.now() / 1000), randomBytes) {
  const target = exactLiveSaveTarget(input);
  const identity = await verifyIssuedAgentCapability(parentToken, { documentId: target.documentId, operation: "request_live_save_authorization", scope: "content:write" }, env, nowSeconds);
  if (!identity.oauth) throw new HttpError(403, "oauth_required", "Live Save step-up requires a Codex OAuth session");
  const row = await authDb(env).prepare("SELECT * FROM agent_capability_requests WHERE id = ? AND parent_oauth_jti = ?").bind(requestId, identity.jti).first();
  if (!row || row.target_json !== JSON.stringify(stable(target))) throw new HttpError(403, "live_save_authorization_invalid", "Live Save authorization does not match this exact commit");
  if (Date.parse(row.expires_at) <= nowSeconds * 1000) throw new HttpError(410, "capability_request_expired", "Live Save authorization expired");
  if (row.state === "pending") return { pending: true };
  if (row.approved_by !== identity.actorId) throw new HttpError(403, "live_save_authorization_invalid", "Live Save approval belongs to a different instructor");
  if (row.state !== "approved") throw new HttpError(409, "capability_request_inactive", "Live Save authorization cannot be consumed");
  return issueAgentCapabilityRow(row, env, nowSeconds, randomBytes, identity.actorId);
}

export async function revokeAgentCapability(jti, reason, session, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const db = authDb(env); const at = iso(nowSeconds); const actorId = `actor_github_${String(session.sub).replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const row = await db.prepare("SELECT * FROM agent_capability_grants WHERE jti = ?").bind(jti).first();
  if (!row) throw new HttpError(404, "capability_not_found", "Capability was not found");
  const request = await db.prepare("SELECT approved_by FROM agent_capability_requests WHERE id = ?").bind(row.issuance_request_id).first();
  if (request?.approved_by !== actorId) throw new HttpError(403, "forbidden", "Only the issuing instructor may revoke this capability");
  await db.batch([
    db.prepare("UPDATE agent_capability_grants SET revoked_at = ?, revoked_by = ?, revocation_reason = ? WHERE jti = ? AND revoked_at IS NULL").bind(at, actorId, String(reason || "Instructor revoked").slice(0, 500), jti),
    audit(env, "grant.revoked", jti, actorId, { reason: String(reason || "Instructor revoked").slice(0, 500) }, at),
  ]);
  return { jti, revoked: true, revokedAt: at };
}

export async function verifyIssuedAgentCapability(token, target, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const oauth = await verifyMcpOAuthAccessToken(token, target, env, nowSeconds);
  if (oauth) return oauth;
  const db = authDb(env); const claims = await verifyToken(token, signingSecret(env), { kind: "agent-capability", now: nowSeconds });
  if (!claims || claims.aud !== "ai-ethics-textbook-mcp" || claims.actorType !== "agent" || typeof claims.jti !== "string") throw new HttpError(401, "invalid_capability", "Capability is invalid or expired");
  const row = await db.prepare("SELECT * FROM agent_capability_grants WHERE jti = ?").bind(claims.jti).first();
  if (!row || row.revoked_at || Date.parse(row.expires_at) <= nowSeconds * 1000 || row.claims_hash !== await capabilityHash(claims)) throw new HttpError(401, "invalid_capability", "Capability is unknown, revoked, mismatched, or expired");
  const documents = parseJson(row.allowed_document_ids_json); const operations = parseJson(row.allowed_operations_json); const scopes = parseJson(row.scopes_json);
  if (target?.documentId && !documents.includes(target.documentId)) throw new HttpError(403, "capability_document_forbidden", "Capability does not allow this chapter");
  if (target?.operation && !operations.includes(target.operation)) throw new HttpError(403, "capability_operation_forbidden", "Capability does not allow this operation");
  if (target?.scope && !scopes.includes(target.scope)) throw new HttpError(403, "capability_scope_forbidden", "Capability does not include the required scope");
  await audit(env, "grant.verified", claims.jti, claims.sub, { target }, iso(nowSeconds)).run();
  return Object.freeze({ actorId: claims.sub, actorType: "agent", clientId: claims.clientId, runId: claims.runId, scopes, allowedDocumentIds: documents, allowedOperations: operations, jti: claims.jti, expiresAt: row.expires_at, originalToken: token });
}
