import { randomBase64Url, signToken, verifyToken } from "./crypto.mjs";
import { pkceChallenge } from "./oauth-state.mjs";
import { HttpError } from "./policy.mjs";

const CLIENT_ID = "codex-ai-ethics-textbook";
const RESOURCE = "https://mcp.ethicsandai.your-digital-life.org";
const BASELINE_SCOPES = Object.freeze(["content:read", "content:write", "media:read", "media:upload"]);
const ALLOWED_SCOPES = new Set(BASELINE_SCOPES);
const DOCUMENTS = Object.freeze(Array.from({ length: 18 }, (_, index) => `chapter_ch${String(index + 1).padStart(2, "0")}`));
const READ_OPERATIONS = Object.freeze(["get_authoring_view", "get_passage", "get_version_history", "get_live_commit_status", "get_person", "search_persons", "search_media", "get_media_job", "get_media_asset"]);
const WRITE_OPERATIONS = Object.freeze(["create_or_resume_changeset", "replace_passage_text", "replace_chapter_document", "upsert_checkpoint", "remove_checkpoint", "reorder_checkpoint", "place_media", "upsert_embed", "resolve_provider_url", "upsert_person_feature", "move_managed_placement", "remove_managed_placement", "preview_changes", "restore_revision_as_draft", "request_live_save_authorization"]);
const MEDIA_UPLOAD_OPERATIONS = Object.freeze(["create_media_review_package", "upload_media"]);
const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const REQUEST_ID = /^oauthreq_[A-Za-z0-9_-]{8,}$/;
const encoder = new TextEncoder();

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
};
const capabilityHash = async (value) => {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(typeof value === "string" ? value : JSON.stringify(stable(value))));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const iso = (seconds) => new Date(seconds * 1000).toISOString();
const authDb = (env) => {
  if (!env.AUTH_STATE_DB?.prepare) throw new HttpError(503, "oauth_unavailable", "OAuth state is unavailable");
  return env.AUTH_STATE_DB;
};
const signingSecret = (env) => {
  const value = env.AGENT_CAPABILITY_SIGNING_SECRET;
  if (typeof value !== "string" || encoder.encode(value).byteLength < 32) throw new HttpError(503, "oauth_unavailable", "OAuth signing is unavailable");
  return value;
};
const parseJson = (value, fallback = []) => { try { return JSON.parse(value); } catch { return fallback; } };
const exactResource = (value) => {
  if (value !== RESOURCE) throw new HttpError(400, "invalid_target", "The OAuth resource is invalid");
  return value;
};
const validRedirect = (value) => {
  let url;
  try { url = new URL(value); } catch { throw new HttpError(400, "invalid_request", "redirect_uri is invalid"); }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !url.port || url.username || url.password || url.hash) {
    throw new HttpError(400, "invalid_request", "redirect_uri must be a loopback HTTP callback with an explicit port");
  }
  return url.toString();
};
const validState = (value) => {
  if (typeof value !== "string" || value.length < 8 || value.length > 1024 || /[\u0000-\u001f\u007f]/.test(value)) throw new HttpError(400, "invalid_request", "state is invalid");
  return value;
};
const scopesFrom = (value) => {
  const scopes = [...new Set(String(value || BASELINE_SCOPES.join(" ")).split(/\s+/).filter(Boolean))].sort();
  if (!scopes.length || scopes.some((scope) => !ALLOWED_SCOPES.has(scope)) || !scopes.includes("content:read")) throw new HttpError(400, "invalid_scope", "Requested OAuth scopes are invalid");
  return scopes;
};
const operationsFor = (scopes) => [...new Set([
  ...(scopes.includes("content:read") ? READ_OPERATIONS : []),
  ...(scopes.includes("content:write") ? WRITE_OPERATIONS : []),
  ...(scopes.includes("media:upload") ? MEDIA_UPLOAD_OPERATIONS : []),
])].sort();

const exactStringArray = (value, allowed, name) => {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string" || !allowed.has(item))) throw new HttpError(400, "invalid_client_metadata", `${name} is invalid`);
  return [...new Set(value)];
};

async function requireRegisteredClient(clientId) {
  if (clientId !== CLIENT_ID) throw new HttpError(400, "unauthorized_client", "OAuth client is not registered");
}

export const mcpOAuthConstants = Object.freeze({ clientId: CLIENT_ID, resource: RESOURCE, scopes: BASELINE_SCOPES });

export function authorizationServerMetadata(authOrigin) {
  return {
    issuer: authOrigin,
    authorization_endpoint: `${authOrigin}/oauth/authorize`,
    token_endpoint: `${authOrigin}/oauth/token`,
    registration_endpoint: `${authOrigin}/oauth/register`,
    revocation_endpoint: `${authOrigin}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...BASELINE_SCOPES],
  };
}

export async function registerMcpOAuthClient(input, env, nowSeconds = Math.floor(Date.now() / 1000), randomBytes) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "invalid_client_metadata", "Client metadata must be an object");
  const redirectUris = [...new Set(exactStringArray(input.redirect_uris, new Set(input.redirect_uris || []), "redirect_uris").map(validRedirect))];
  if (redirectUris.length > 10) throw new HttpError(400, "invalid_client_metadata", "Too many redirect URIs");
  if ((input.token_endpoint_auth_method ?? "none") !== "none") throw new HttpError(400, "invalid_client_metadata", "Only public PKCE clients are supported");
  const grantTypes = exactStringArray(input.grant_types ?? ["authorization_code", "refresh_token"], new Set(["authorization_code", "refresh_token"]), "grant_types");
  const responseTypes = exactStringArray(input.response_types ?? ["code"], new Set(["code"]), "response_types");
  if (!grantTypes.includes("authorization_code") || !responseTypes.includes("code")) throw new HttpError(400, "invalid_client_metadata", "Authorization code support is required");
  const clientName = typeof input.client_name === "string" && input.client_name.trim() ? input.client_name.trim().slice(0, 120) : "Codex MCP client";
  // All Codex instances are the same public native application. Returning the
  // pre-registered client avoids a public registration table that could be
  // filled by unauthenticated traffic; PKCE and the loopback-only redirect
  // policy bind each authorization transaction independently.
  return {
    client_id: CLIENT_ID,
    client_id_issued_at: nowSeconds,
    client_name: clientName,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: grantTypes,
    response_types: responseTypes,
  };
}

export async function createMcpOAuthAuthorizationRequest(url, env, nowSeconds = Math.floor(Date.now() / 1000), randomBytes) {
  const clientId = url.searchParams.get("client_id");
  if (url.searchParams.get("response_type") !== "code") throw new HttpError(400, "unsupported_response_type", "Only authorization code is supported");
  const redirectUri = validRedirect(url.searchParams.get("redirect_uri"));
  await requireRegisteredClient(clientId);
  const resource = exactResource(url.searchParams.get("resource"));
  const state = validState(url.searchParams.get("state"));
  const challenge = url.searchParams.get("code_challenge");
  if (!CODE_CHALLENGE.test(challenge || "") || url.searchParams.get("code_challenge_method") !== "S256") throw new HttpError(400, "invalid_request", "PKCE S256 is required");
  const scopes = scopesFrom(url.searchParams.get("scope"));
  const requestId = `oauthreq_${randomBase64Url(18, randomBytes)}`;
  const requestedAt = iso(nowSeconds); const expiresAt = iso(nowSeconds + 600);
  await authDb(env).prepare(`INSERT INTO mcp_oauth_authorization_requests
    (id, client_id, redirect_uri, resource, scopes_json, state_value, code_challenge, requested_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(requestId, clientId, redirectUri, resource, JSON.stringify(scopes), state, challenge, requestedAt, expiresAt).run();
  return { requestId };
}

export async function getMcpOAuthAuthorizationRequest(requestId, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!REQUEST_ID.test(requestId || "")) throw new HttpError(400, "invalid_request", "OAuth authorization request is invalid");
  const row = await authDb(env).prepare("SELECT * FROM mcp_oauth_authorization_requests WHERE id = ?").bind(requestId).first();
  if (!row || Date.parse(row.expires_at) <= nowSeconds * 1000 || row.code_consumed_at) throw new HttpError(400, "invalid_request", "OAuth authorization request expired or was consumed");
  return row;
}

export async function approveMcpOAuthAuthorizationRequest(requestId, session, env, nowSeconds = Math.floor(Date.now() / 1000), randomBytes) {
  const db = authDb(env); const row = await getMcpOAuthAuthorizationRequest(requestId, env, nowSeconds);
  if (row.approved_by || row.code_hash) throw new HttpError(409, "invalid_request", "OAuth authorization request was already approved");
  const actorId = `actor_github_${String(session.sub).replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const code = `mcp_code_${randomBase64Url(32, randomBytes)}`; const at = iso(nowSeconds);
  const result = await db.prepare("UPDATE mcp_oauth_authorization_requests SET approved_by = ?, approved_at = ?, code_hash = ?, code_issued_at = ? WHERE id = ? AND approved_by IS NULL")
    .bind(actorId, at, await capabilityHash(code), at, requestId).run();
  if (result?.meta?.changes === 0) throw new HttpError(409, "invalid_request", "OAuth authorization request changed");
  const redirect = new URL(row.redirect_uri); redirect.searchParams.set("code", code); redirect.searchParams.set("state", row.state_value);
  return redirect.toString();
}

async function issueGrant(row, env, nowSeconds, randomBytes) {
  const db = authDb(env); const at = iso(nowSeconds);
  const grantId = `oauthgrant_${randomBase64Url(18, randomBytes)}`;
  const accessJti = `oauth_${randomBase64Url(18, randomBytes)}`;
  const refreshToken = `mcp_refresh_${randomBase64Url(40, randomBytes)}`;
  const scopes = parseJson(row.scopes_json); const operations = operationsFor(scopes);
  const runId = `oauth_run_${randomBase64Url(12, randomBytes)}`;
  const claims = { v: 1, kind: "oauth-access", iss: "ai-ethics-editor-auth", aud: "ai-ethics-textbook-mcp", sub: row.approved_by, actorType: "agent", clientId: row.client_id, runId, scopes, allowedDocumentIds: DOCUMENTS, allowedOperations: operations, iat: nowSeconds, exp: nowSeconds + 900, jti: accessJti };
  const accessToken = await signToken(claims, signingSecret(env));
  await db.batch([
    db.prepare(`INSERT INTO mcp_oauth_grants
      (id, access_jti, actor_id, client_id, run_id, claims_hash, scopes_json, allowed_document_ids_json, allowed_operations_json, refresh_token_hash, issued_at, access_expires_at, refresh_expires_at, authorization_request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(grantId, accessJti, row.approved_by, row.client_id, runId, await capabilityHash(claims), JSON.stringify(scopes), JSON.stringify(DOCUMENTS), JSON.stringify(operations), await capabilityHash(refreshToken), at, iso(claims.exp), iso(nowSeconds + 30 * 24 * 60 * 60), row.id),
    db.prepare("UPDATE mcp_oauth_authorization_requests SET code_consumed_at = ? WHERE id = ? AND code_consumed_at IS NULL").bind(at, row.id),
  ]);
  return { access_token: accessToken, token_type: "Bearer", expires_in: 900, refresh_token: refreshToken, scope: scopes.join(" ") };
}

export async function exchangeMcpOAuthCode(input, env, nowSeconds = Math.floor(Date.now() / 1000), randomBytes) {
  const db = authDb(env);
  if (input.get("grant_type") !== "authorization_code") throw new HttpError(400, "invalid_grant", "Authorization code request is invalid");
  const code = input.get("code"); const verifier = input.get("code_verifier");
  if (typeof code !== "string" || !CODE_VERIFIER.test(verifier || "")) throw new HttpError(400, "invalid_grant", "Authorization code or verifier is invalid");
  const row = await db.prepare("SELECT * FROM mcp_oauth_authorization_requests WHERE code_hash = ?").bind(await capabilityHash(code)).first();
  if (!row || row.client_id !== input.get("client_id") || row.code_consumed_at || !row.approved_by || Date.parse(row.expires_at) <= nowSeconds * 1000 || row.redirect_uri !== validRedirect(input.get("redirect_uri")) || row.resource !== exactResource(input.get("resource")) || row.code_challenge !== await pkceChallenge(verifier)) throw new HttpError(400, "invalid_grant", "Authorization code is invalid, expired, or already used");
  return issueGrant(row, env, nowSeconds, randomBytes);
}

export async function refreshMcpOAuthGrant(input, env, nowSeconds = Math.floor(Date.now() / 1000), randomBytes) {
  if (input.get("grant_type") !== "refresh_token" || exactResource(input.get("resource")) !== RESOURCE) throw new HttpError(400, "invalid_grant", "Refresh request is invalid");
  const refreshToken = input.get("refresh_token");
  if (typeof refreshToken !== "string" || refreshToken.length < 40) throw new HttpError(400, "invalid_grant", "Refresh token is invalid");
  const db = authDb(env); const row = await db.prepare("SELECT * FROM mcp_oauth_grants WHERE refresh_token_hash = ?").bind(await capabilityHash(refreshToken)).first();
  if (!row || row.client_id !== input.get("client_id") || row.revoked_at || Date.parse(row.refresh_expires_at) <= nowSeconds * 1000) throw new HttpError(400, "invalid_grant", "Refresh token is invalid, expired, or revoked");
  const accessJti = `oauth_${randomBase64Url(18, randomBytes)}`; const nextRefresh = `mcp_refresh_${randomBase64Url(40, randomBytes)}`; const at = iso(nowSeconds);
  const scopes = parseJson(row.scopes_json); const documents = parseJson(row.allowed_document_ids_json); const operations = parseJson(row.allowed_operations_json);
  const claims = { v: 1, kind: "oauth-access", iss: "ai-ethics-editor-auth", aud: "ai-ethics-textbook-mcp", sub: row.actor_id, actorType: "agent", clientId: row.client_id, runId: row.run_id, scopes, allowedDocumentIds: documents, allowedOperations: operations, iat: nowSeconds, exp: nowSeconds + 900, jti: accessJti };
  const accessToken = await signToken(claims, signingSecret(env));
  const result = await db.prepare("UPDATE mcp_oauth_grants SET access_jti = ?, claims_hash = ?, refresh_token_hash = ?, access_expires_at = ?, refreshed_at = ? WHERE id = ? AND refresh_token_hash = ?")
    .bind(accessJti, await capabilityHash(claims), await capabilityHash(nextRefresh), iso(claims.exp), at, row.id, await capabilityHash(refreshToken)).run();
  if (result?.meta?.changes === 0) throw new HttpError(400, "invalid_grant", "Refresh token was already rotated");
  return { access_token: accessToken, token_type: "Bearer", expires_in: 900, refresh_token: nextRefresh, scope: scopes.join(" ") };
}

export async function revokeMcpOAuthToken(token, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || !token) return;
  const db = authDb(env); const hash = await capabilityHash(token); const at = iso(nowSeconds);
  await db.prepare("UPDATE mcp_oauth_grants SET revoked_at = ?, revoked_by = ?, revocation_reason = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL")
    .bind(at, "oauth_client", "OAuth client logout", hash).run();
  const claims = await verifyToken(token, signingSecret(env), { kind: "oauth-access", now: nowSeconds });
  if (claims?.jti) await db.prepare("UPDATE mcp_oauth_grants SET revoked_at = ?, revoked_by = ?, revocation_reason = ? WHERE access_jti = ? AND revoked_at IS NULL")
    .bind(at, "oauth_client", "OAuth client logout", claims.jti).run();
}

export async function verifyMcpOAuthAccessToken(token, target, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const claims = await verifyToken(token, signingSecret(env), { kind: "oauth-access", now: nowSeconds });
  if (!claims || claims.aud !== "ai-ethics-textbook-mcp" || claims.actorType !== "agent" || typeof claims.jti !== "string") return null;
  const row = await authDb(env).prepare("SELECT * FROM mcp_oauth_grants WHERE access_jti = ?").bind(claims.jti).first();
  if (!row || row.revoked_at || Date.parse(row.access_expires_at) <= nowSeconds * 1000 || row.claims_hash !== await capabilityHash(claims)) throw new HttpError(401, "invalid_capability", "OAuth access token is unknown, revoked, mismatched, or expired");
  const scopes = parseJson(row.scopes_json); const documents = parseJson(row.allowed_document_ids_json); const operations = parseJson(row.allowed_operations_json);
  if (target?.documentId && !documents.includes(target.documentId)) throw new HttpError(403, "capability_document_forbidden", "OAuth token does not allow this chapter");
  if (target?.operation && !operations.includes(target.operation)) throw new HttpError(403, "capability_operation_forbidden", "OAuth token does not allow this operation");
  if (target?.scope && !scopes.includes(target.scope)) throw new HttpError(403, "capability_scope_forbidden", "OAuth token does not include the required scope");
  return Object.freeze({ actorId: claims.sub, actorType: "agent", clientId: claims.clientId, runId: claims.runId, scopes, allowedDocumentIds: documents, allowedOperations: operations, jti: claims.jti, expiresAt: row.access_expires_at, originalToken: token, oauth: true });
}
