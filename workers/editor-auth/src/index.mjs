import {
  GITHUB_API,
  GITHUB_WEB,
  MAX_REQUEST_BYTES,
  REPOSITORY,
  SESSION_COOKIE,
  STATE_COOKIE,
} from "./constants.mjs";
import {
  constantTimeEqual,
  randomBase64Url,
  signToken,
  verifyToken,
} from "./crypto.mjs";
import {
  GitHubUpstreamError,
  exchangeOAuthCode,
  getAuthenticatedUser,
  mintInstallationToken,
  openEditorPullRequest,
  readRepositoryFile,
  verifyUserRepositoryAccess,
} from "./github.mjs";
import {
  HttpError,
  getRuntimeConfig,
  requireAllowedOrigin,
  validateEditablePath,
  validatePullRequestInput,
} from "./policy.mjs";
import {
  approveAgentCapabilityRequest,
  consumeBoundLiveSaveRequest,
  createAgentCapabilityRequest,
  createBoundLiveSaveRequest,
  exchangeAgentCapabilityRequest,
  getAgentCapabilityRequest,
  revokeAgentCapability,
  verifyIssuedAgentCapability,
} from "./capabilities.mjs";
import { CHAPTER_ROUTE_BY_SLUG } from "./chapter-route-manifest.mjs";
import {
  cleanupExpiredOAuthStates,
  consumeOAuthState,
  createOAuthState,
  editorTargetUrl,
  validateOAuthTarget,
} from "./oauth-state.mjs";
import {
  approveMcpOAuthAuthorizationRequest,
  authorizationServerMetadata,
  createMcpOAuthAuthorizationRequest,
  exchangeMcpOAuthCode,
  getMcpOAuthAuthorizationRequest,
  registerMcpOAuthClient,
  refreshMcpOAuthGrant,
  revokeMcpOAuthToken,
} from "./mcp-oauth.mjs";

const encoder = new TextEncoder();

const baseSecurityHeaders = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

function secureHeaders(origin, additions = undefined) {
  const headers = new Headers(baseSecurityHeaders);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }
  if (additions) {
    for (const [name, value] of Object.entries(additions)) headers.append(name, value);
  }
  return headers;
}

function json(payload, status = 200, { origin, headers: additions } = {}) {
  const headers = secureHeaders(origin, additions);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { status, headers });
}

function empty(status = 204, { origin, headers: additions } = {}) {
  return new Response(null, { status, headers: secureHeaders(origin, additions) });
}

function html(payload, status = 200) {
  const headers = secureHeaders();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
  return new Response(payload, { status, headers });
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function redirect(location, { cookies = [] } = {}) {
  const headers = secureHeaders(undefined, { Location: location });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function cookie(name, value, { maxAge, sameSite }) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=${sameSite}`;
}

function clearCookie(name, sameSite) {
  return `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=${sameSite}`;
}

function parseCookies(request) {
  const result = new Map();
  for (const item of (request.headers.get("Cookie") ?? "").split(";")) {
    const index = item.indexOf("=");
    if (index <= 0) continue;
    result.set(item.slice(0, index).trim(), item.slice(index + 1).trim());
  }
  return result;
}

function safeErrorResponse(error, origin, callback = false) {
  let response;
  if (error instanceof HttpError) {
    response = json({ error: error.code, message: error.message, ...(error.details ?? {}) }, error.status, { origin });
  } else if (error instanceof GitHubUpstreamError) {
    response = json({ error: "github_unavailable", message: "GitHub could not complete the editor request" }, 502, { origin });
  } else {
    response = json({ error: "internal_error", message: "The editor service could not complete the request" }, 500, { origin });
  }
  if (callback) response.headers.append("Set-Cookie", clearCookie(STATE_COOKIE, "Lax"));
  return response;
}

async function callbackStage(stage, operation) {
  try {
    return await operation();
  } catch (error) {
    const diagnostic = {
      event: "editor_auth_callback_failure",
      stage,
      kind: error instanceof GitHubUpstreamError ? "github_upstream" : error instanceof HttpError ? "policy" : "internal",
      name: typeof error?.name === "string" ? error.name : "UnknownError",
      ...(error instanceof GitHubUpstreamError ? { upstreamStatus: error.status, upstreamOperation: error.operation } : {}),
      ...(!(error instanceof GitHubUpstreamError) && !(error instanceof HttpError) && typeof error?.message === "string"
        ? { internalMessage: error.message.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]").slice(0, 160) }
        : {}),
    };
    console.error(JSON.stringify(diagnostic));
    throw error;
  }
}

function safeAllowedOrigin(request, env) {
  try {
    const config = getRuntimeConfig(env);
    const origin = request.headers.get("Origin");
    return origin && config.origins.has(origin) ? origin : undefined;
  } catch {
    return undefined;
  }
}

function optionalAllowedOrigin(request, config) {
  return request.headers.get("Origin") ? requireAllowedOrigin(request, config) : undefined;
}

const CAPABILITY_REQUEST_PATH = /^\/auth\/agent-capability-requests\/(capreq_[A-Za-z0-9_-]{8,})$/;
const CAPABILITY_EXCHANGE_PATH = /^\/auth\/agent-capability-requests\/(capreq_[A-Za-z0-9_-]{8,}):exchange$/;
const CAPABILITY_REVOKE_PATH = /^\/auth\/agent-capabilities\/(cap_[A-Za-z0-9_-]{8,}):revoke$/;

/**
 * The service-bound API used by MCP and the content gateway.  It is intentionally
 * not reachable over this Worker's HTTP surface; the production RPC entrypoint
 * in worker.mjs delegates to this factory.
 */
export function createCapabilityVerifier(env, { now = () => Math.floor(Date.now() / 1000), randomBytes } = {}) {
  return Object.freeze({
    verifyCapability(token, target = {}) {
      return verifyIssuedAgentCapability(token, target, env, now());
    },
    requestLiveSaveAuthorization(token, target) {
      return createBoundLiveSaveRequest(token, target, env, now(), randomBytes);
    },
    consumeLiveSaveAuthorization(token, requestId, target) {
      return consumeBoundLiveSaveRequest(token, requestId, target, env, now(), randomBytes);
    },
  });
}

async function requireSession(request, config, now) {
  const encoded = parseCookies(request).get(SESSION_COOKIE);
  const session = await verifyToken(encoded, config.sessionSecret, { kind: "session", now });
  if (
    !session
    || !/^\d+$/.test(String(session.sub ?? ""))
    || typeof session.login !== "string"
    || typeof session.csrf !== "string"
    || !config.allowedUserIds.has(String(session.sub))
  ) {
    throw new HttpError(401, "unauthorized", "A valid editor session is required");
  }
  return session;
}

async function optionalSession(request, config, now) {
  try {
    return await requireSession(request, config, now);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return null;
    throw error;
  }
}

function requireCsrf(request, session) {
  const supplied = request.headers.get("X-Editor-CSRF");
  if (!constantTimeEqual(supplied, session.csrf)) {
    throw new HttpError(403, "csrf_failed", "The editor request could not be verified");
  }
}

async function readJsonBody(request) {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new HttpError(415, "json_required", "The request must use application/json");
  }
  const declaredLength = Number.parseInt(request.headers.get("Content-Length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "request_too_large", "The editor request is too large");
  }
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "request_too_large", "The editor request is too large");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_json", "The request body is not valid JSON");
  }
}

async function readFormBody(request) {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded")) throw new HttpError(415, "invalid_request", "The request must use form encoding");
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > 16384) throw new HttpError(413, "request_too_large", "The OAuth request is too large");
  return new URLSearchParams(raw);
}

function validateOAuthCode(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 512 || /\s/.test(value)) {
    throw new HttpError(400, "invalid_callback", "The GitHub callback is invalid");
  }
  return value;
}

const contentMutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024;

async function forwardContentApi(request, env, session, origin) {
  if (!env.CONTENT_API || typeof env.CONTENT_API.fetch !== "function") {
    throw new HttpError(503, "content_api_unavailable", "The authoring content service is unavailable");
  }
  const url = new URL(request.url);
  const headers = new Headers();
  for (const name of ["accept", "content-type", "content-length", "idempotency-key", "if-match", "x-request-id", "x-content-sha256", "x-upload-token"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-content-gateway-verified", "v1");
  headers.set("x-content-actor-id", `actor_github_${String(session.sub).replace(/[^A-Za-z0-9_-]/g, "_")}`);
  headers.set("x-content-actor-type", "human");
  headers.set("x-content-client-id", "textbook-editor");
  headers.set("x-content-run-id", `browser_${session.sub}_${session.iat}`);
  headers.set("x-content-scopes", env.EDITOR_CONTENT_SCOPES || "content:read content:write content:submit content:approve media:upload");

  let body;
  if (!new Set(["GET", "HEAD"]).has(request.method)) {
    const declaredLength = Number.parseInt(request.headers.get("Content-Length") ?? "0", 10);
    const requestLimit = request.method === "PUT" && /^\/v1\/media\/uploads\/[A-Za-z0-9._:-]+$/.test(url.pathname) ? MAX_MEDIA_UPLOAD_BYTES : MAX_REQUEST_BYTES;
    if (Number.isFinite(declaredLength) && declaredLength > requestLimit) {
      throw new HttpError(413, "request_too_large", "The editor request is too large");
    }
    body = await request.arrayBuffer();
    if (body.byteLength > requestLimit) {
      throw new HttpError(413, "request_too_large", "The editor request is too large");
    }
  }

  const upstream = await env.CONTENT_API.fetch(new Request(`https://content-api.internal${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body,
  }));
  const responseHeaders = secureHeaders(origin);
  responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8");
  for (const name of ["etag", "idempotent-replay", "retry-after", "x-request-id"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

async function forwardProcessorCallback(request, env) {
  if (!env.CONTENT_API || typeof env.CONTENT_API.fetch !== "function") return new Response("Unavailable", { status: 503, headers: baseSecurityHeaders });
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > 131072) return new Response("Too large", { status: 413, headers: baseSecurityHeaders });
  const body = await request.arrayBuffer();
  if (body.byteLength > 131072) return new Response("Too large", { status: 413, headers: baseSecurityHeaders });
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "idempotency-key", "x-media-signature"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await env.CONTENT_API.fetch(new Request("https://content-api.internal/v1/media:processorCallback", { method: "POST", headers, body }));
  return new Response(upstream.body, { status: upstream.status, headers: { ...baseSecurityHeaders, "Content-Type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8" } });
}

async function forwardReleaseArtifact(request, env) {
  if (!env.CONTENT_API || typeof env.CONTENT_API.fetch !== "function") return new Response("Unavailable", { status: 503, headers: baseSecurityHeaders });
  const configured = env.RELEASE_SNAPSHOT_READ_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (typeof configured !== "string" || configured.length < 32 || !constantTimeEqual(supplied, configured)) return new Response("Unauthorized", { status: 401, headers: { ...baseSecurityHeaders, "WWW-Authenticate": "Bearer" } });
  const url = new URL(request.url);
  const headers = new Headers({
    accept: url.pathname.startsWith("/v1/release-assets/") ? "application/octet-stream, */*" : "application/json",
    "x-content-gateway-verified": "v1",
    "x-content-actor-id": "actor_release_workflow",
    "x-content-actor-type": "service",
    "x-content-client-id": "github-content-release",
    "x-content-run-id": request.headers.get("x-github-run-id") || "release_artifact_fetch",
    "x-content-scopes": "content:releaseSnapshot",
  });
  const upstream = await env.CONTENT_API.fetch(new Request(`https://content-api.internal${url.pathname}`, { headers }));
  const responseHeaders = new Headers(baseSecurityHeaders);
  responseHeaders.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  for (const name of ["cache-control", "content-disposition", "content-length", "etag", "x-content-sha256", "x-content-snapshot-revision"]) { const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value); }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

async function forwardReleaseControl(request, env) {
  if (!env.CONTENT_API || typeof env.CONTENT_API.fetch !== "function") return new Response("Unavailable", { status: 503, headers: baseSecurityHeaders });
  const configured = env.RELEASE_DEPLOY_RECEIPT_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (typeof configured !== "string" || configured.length < 32 || !constantTimeEqual(supplied, configured)) return new Response("Unauthorized", { status: 401, headers: { ...baseSecurityHeaders, "WWW-Authenticate": "Bearer" } });
  const runId = request.headers.get("x-github-run-id") ?? "";
  if (!/^\d{1,30}$/.test(runId)) return new Response("GitHub run identity required", { status: 401, headers: baseSecurityHeaders });
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > 65536) return new Response("Too large", { status: 413, headers: baseSecurityHeaders });
  const body = await request.arrayBuffer();
  if (body.byteLength > 65536) return new Response("Too large", { status: 413, headers: baseSecurityHeaders });
  const url = new URL(request.url);
  const scope = url.pathname.startsWith('/v1/authority') || url.pathname.endsWith(':auditState') ? 'content:authority' : 'content:deployReceipt';
  const headers = new Headers({
    "content-type": "application/json",
    "x-content-gateway-verified": "v1",
    "x-content-actor-id": "actor_release_workflow",
    "x-content-actor-type": "service",
    "x-content-client-id": "github-content-release",
    "x-content-run-id": runId,
    "x-content-scopes": scope,
  });
  const upstream = await env.CONTENT_API.fetch(new Request(`https://content-api.internal${url.pathname}`, { method: "POST", headers, body }));
  const responseHeaders = new Headers(baseSecurityHeaders);
  responseHeaders.set("Content-Type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
  for (const name of ["idempotent-replay", "retry-after", "x-request-id"]) { const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value); }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export function createEditorAuthApp(dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const nowProvider = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const randomBytes = dependencies.randomBytes;
  const mintToken = dependencies.mintInstallationToken ?? mintInstallationToken;

  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const now = nowProvider();
      let origin;
      try {
        if (url.pathname === "/health" && request.method === "GET") {
          return json({ ok: true, service: "phil123-editor-auth", repository: `${REPOSITORY.owner}/${REPOSITORY.name}` });
        }

        if (url.pathname === "/v1/media:processorCallback") {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          return await forwardProcessorCallback(request, env);
        }

        if (/^\/v1\/release-(?:snapshots|assets)\/[a-f0-9]{64}$/.test(url.pathname)) {
          if (request.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET for this endpoint");
          return await forwardReleaseArtifact(request, env);
        }

        if (url.pathname === "/v1/release-deployments:stage"
          || url.pathname === "/v1/release-deployments:pending"
          || /^\/v1\/release-deployments\/[A-Za-z0-9][A-Za-z0-9._:-]{0,199}:(?:recordReceipt|reconcileReceipt|abandon)$/.test(url.pathname)
          || /^\/v1\/releases\/[A-Za-z0-9][A-Za-z0-9._:-]{0,199}:stageRollback$/.test(url.pathname)
          || /^\/v1\/releases\/[A-Za-z0-9][A-Za-z0-9._:-]{0,199}:auditState$/.test(url.pathname)
          || url.pathname === "/v1/authority:prepareCutover"
          || url.pathname === "/v1/authority:activateD1"
          || url.pathname === "/v1/authority/chapter_ch07:activateD1") {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          return await forwardReleaseControl(request, env);
        }

        const config = getRuntimeConfig(env);

        if (url.pathname === "/.well-known/oauth-authorization-server" && request.method === "GET") {
          return json(authorizationServerMetadata(config.authBaseUrl));
        }

        if (url.pathname === "/oauth/token") {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          const input = await readFormBody(request);
          const grantType = input.get("grant_type");
          const result = grantType === "authorization_code"
            ? await exchangeMcpOAuthCode(input, env, now, randomBytes)
            : grantType === "refresh_token"
              ? await refreshMcpOAuthGrant(input, env, now, randomBytes)
              : (() => { throw new HttpError(400, "unsupported_grant_type", "OAuth grant type is unsupported"); })();
          return json(result, 200, { headers: { Pragma: "no-cache" } });
        }

        if (url.pathname === "/oauth/register") {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          return json(await registerMcpOAuthClient(await readJsonBody(request), env, now, randomBytes), 201);
        }

        if (url.pathname === "/oauth/revoke") {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          const input = await readFormBody(request);
          await revokeMcpOAuthToken(input.get("token"), env, now);
          return empty(200);
        }

        if (url.pathname === "/oauth/authorize") {
          if (request.method === "POST") {
            const session = await requireSession(request, config, now);
            const input = await readFormBody(request);
            if (!constantTimeEqual(input.get("csrf"), session.csrf)) throw new HttpError(403, "csrf_failed", "The OAuth approval could not be verified");
            const destination = await approveMcpOAuthAuthorizationRequest(input.get("request"), session, env, now, randomBytes);
            const safeDestination = escapeHtml(destination);
            return html(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="0; url=${safeDestination}"><title>Return to Codex</title><style>body{font:18px/1.55 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1.25rem;color:#102846;background:#fbf7ed}main{background:white;border:1px solid #ccd5df;padding:2rem;border-radius:1rem}h1{font:700 2.4rem/1.05 Georgia,serif}a{display:inline-block;border-radius:.6rem;background:#9b351d;color:white;padding:.9rem 1.2rem;font-weight:700;text-decoration:none}</style><main><p>AI Ethics Textbook</p><h1>Textbook access approved</h1><p>Returning you to Codex now. If Chrome blocks the automatic handoff, use the button below.</p><p><a href="${safeDestination}">Return to Codex</a></p></main></html>`);
          }
          if (request.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET or POST for this endpoint");
          let requestId = url.searchParams.get("request");
          if (!requestId) {
            ({ requestId } = await createMcpOAuthAuthorizationRequest(url, env, now, randomBytes));
            const session = await optionalSession(request, config, now);
            if (!session) {
              const signIn = new URL("/auth/start", config.authBaseUrl);
              signIn.searchParams.set("mode", "mcp-oauth");
              signIn.searchParams.set("request", requestId);
              return redirect(signIn.toString());
            }
          }
          const session = await optionalSession(request, config, now);
          if (!session) {
            const signIn = new URL("/auth/start", config.authBaseUrl);
            signIn.searchParams.set("mode", "mcp-oauth");
            signIn.searchParams.set("request", requestId);
            return redirect(signIn.toString());
          }
          const oauthRequest = await getMcpOAuthAuthorizationRequest(requestId, env, now);
          const scopes = JSON.parse(oauthRequest.scopes_json);
          return html(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Authorize AI Ethics Textbook</title><style>body{font:18px/1.55 system-ui,sans-serif;max-width:44rem;margin:4rem auto;padding:0 1.25rem;color:#102846;background:#fbf7ed}main{background:white;border:1px solid #ccd5df;padding:2rem;border-radius:1rem}h1{font:700 2.4rem/1.05 Georgia,serif}li{margin:.4rem 0}button{border:0;border-radius:.6rem;background:#9b351d;color:white;padding:.9rem 1.2rem;font:700 1rem system-ui;cursor:pointer}</style><main><p>AI Ethics Textbook</p><h1>Connect Codex to your textbook</h1><p>Signed in as <strong>${escapeHtml(session.login)}</strong>. Codex is requesting trusted chapter editing and publishing access. It may publish a validated D1-authoritative chapter only when you explicitly ask it to save or publish.</p><ul>${scopes.map((scope) => `<li><code>${escapeHtml(scope)}</code></li>`).join("")}</ul><form method="post" action="/oauth/authorize"><input type="hidden" name="request" value="${escapeHtml(requestId)}"><input type="hidden" name="csrf" value="${escapeHtml(session.csrf)}"><button type="submit">Allow textbook editing and publishing</button></form></main></html>`);
        }

        if (request.method === "OPTIONS" && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/") || url.pathname === "/auth/logout" || url.pathname.startsWith("/auth/agent-capability-requests/") || url.pathname === "/auth/agent-capability-requests" || url.pathname.startsWith("/auth/agent-capabilities/"))) {
          origin = requireAllowedOrigin(request, config);
          return empty(204, {
            origin,
            headers: {
              "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key, If-Match, X-Content-Sha256, X-Editor-CSRF, X-Request-Id, X-Upload-Token",
              "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
              "Access-Control-Max-Age": "600",
            },
          });
        }

        if (url.pathname === "/auth/start") {
          if (request.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET for this endpoint");
          if (request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || Number.parseInt(request.headers.get("Content-Length") ?? "0", 10) > 0) {
            throw new HttpError(400, "invalid_oauth_target", "The editor sign-in request must not have a body");
          }
          const target = validateOAuthTarget(url, CHAPTER_ROUTE_BY_SLUG);
          const existingSession = await optionalSession(request, config, now);
          // Agent Live Save approval is a deliberate step-up action. Always go
          // through GitHub again so the resulting session has a fresh stepUpAt.
          if (existingSession && target.mode !== "agent-access") return redirect(editorTargetUrl(config.editorOrigin, target, config.authBaseUrl));
          const clientId = env.GITHUB_APP_CLIENT_ID;
          if (typeof clientId !== "string" || !clientId.trim()) throw new Error("GITHUB_APP_CLIENT_ID is not configured");
          const oauth = await createOAuthState(target, env, now, config.stateTtl, randomBytes);
          const state = await signToken({
            v: 1,
            kind: "state",
            nonce: oauth.nonce,
            target,
            iat: now,
            exp: now + config.stateTtl,
          }, config.sessionSecret);
          const authorization = new URL(`${GITHUB_WEB}/login/oauth/authorize`);
          authorization.searchParams.set("client_id", clientId.trim());
          authorization.searchParams.set("redirect_uri", `${config.authBaseUrl}/auth/callback`);
          authorization.searchParams.set("state", state);
          authorization.searchParams.set("code_challenge", oauth.challenge);
          authorization.searchParams.set("code_challenge_method", "S256");
          authorization.searchParams.set("allow_signup", "false");
          return redirect(authorization.href, {
            cookies: [cookie(STATE_COOKIE, state, { maxAge: config.stateTtl, sameSite: "Lax" })],
          });
        }

        if (url.pathname === "/auth/callback") {
          if (request.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET for this endpoint");
          const callbackState = url.searchParams.get("state");
          const cookieState = parseCookies(request).get(STATE_COOKIE);
          if (!constantTimeEqual(callbackState, cookieState)) {
            throw new HttpError(400, "state_mismatch", "The GitHub login state did not match");
          }
          const state = await verifyToken(callbackState, config.sessionSecret, { kind: "state", now });
          if (!state || typeof state.nonce !== "string" || !state.target) {
            throw new HttpError(400, "state_expired", "The GitHub login state expired");
          }

          const consumed = await callbackStage("state_consume", () => consumeOAuthState(state, env, now));
          const code = validateOAuthCode(url.searchParams.get("code"));
          const userToken = await callbackStage("oauth_exchange", () => exchangeOAuthCode(env, code, `${config.authBaseUrl}/auth/callback`, consumed.verifier, fetchImpl));
          const user = await callbackStage("user_lookup", () => getAuthenticatedUser(userToken, fetchImpl));
          if (!config.allowedUserIds.has(String(user.id))) {
            throw new HttpError(403, "user_not_allowed", "This GitHub account is not an editor");
          }
          await callbackStage("repository_access", () => verifyUserRepositoryAccess(env, userToken, fetchImpl));

          const csrf = randomBase64Url(24, randomBytes);
          const session = await callbackStage("session_sign", () => signToken({
            v: 1,
            kind: "session",
            sub: String(user.id),
            login: user.login,
            csrf,
            iat: now,
            stepUpAt: now,
            exp: now + config.sessionTtl,
          }, config.sessionSecret));
          return redirect(editorTargetUrl(config.editorOrigin, consumed.target, config.authBaseUrl), {
            cookies: [
              cookie(SESSION_COOKIE, session, { maxAge: config.sessionTtl, sameSite: "Strict" }),
              clearCookie(STATE_COOKIE, "Lax"),
            ],
          });
        }

        if (url.pathname === "/auth/agent-capability-requests") {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          origin = optionalAllowedOrigin(request, config);
          const result = await createAgentCapabilityRequest(await readJsonBody(request), env, now, randomBytes);
          return json(result, 201, { origin });
        }

        const exchangeMatch = url.pathname.match(CAPABILITY_EXCHANGE_PATH);
        if (exchangeMatch) {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          origin = optionalAllowedOrigin(request, config);
          const input = await readJsonBody(request);
          const result = await exchangeAgentCapabilityRequest(exchangeMatch[1], input?.deviceSecret, env, now, randomBytes);
          return json(result, 200, { origin });
        }

        const approvalMatch = url.pathname.match(CAPABILITY_REQUEST_PATH);
        if (approvalMatch) {
          origin = requireAllowedOrigin(request, config);
          const session = await requireSession(request, config, now);
          if (request.method === "GET") return json(await getAgentCapabilityRequest(approvalMatch[1], env, now), 200, { origin });
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use GET or POST for this endpoint");
          requireCsrf(request, session);
          const result = await approveAgentCapabilityRequest(approvalMatch[1], await readJsonBody(request), session, env, now);
          return json(result, 200, { origin });
        }

        const revokeMatch = url.pathname.match(CAPABILITY_REVOKE_PATH);
        if (revokeMatch) {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          origin = requireAllowedOrigin(request, config);
          const session = await requireSession(request, config, now);
          requireCsrf(request, session);
          const result = await revokeAgentCapability(revokeMatch[1], (await readJsonBody(request))?.reason, session, env, now);
          return json(result, 200, { origin });
        }

        if (url.pathname === "/api/session") {
          if (request.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET for this endpoint");
          origin = requireAllowedOrigin(request, config);
          const session = await requireSession(request, config, now);
          return json({
            authenticated: true,
            user: { id: Number.parseInt(session.sub, 10), login: session.login },
            csrf_token: session.csrf,
            expires_at: session.exp,
            repository: {
              owner: config.repository.owner,
              name: config.repository.name,
              branch: config.repository.branch,
            },
          }, 200, { origin });
        }

        if (url.pathname === "/api/file") {
          if (request.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET for this endpoint");
          origin = requireAllowedOrigin(request, config);
          await requireSession(request, config, now);
          const path = validateEditablePath(url.searchParams.get("path"));
          const result = await readRepositoryFile(env, path, { fetchImpl, now, mintToken });
          return json(result, 200, { origin });
        }

        if (url.pathname === "/api/pull-requests") {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          origin = requireAllowedOrigin(request, config);
          const session = await requireSession(request, config, now);
          requireCsrf(request, session);
          const input = validatePullRequestInput(await readJsonBody(request));
          const result = await openEditorPullRequest(env, input, {
            fetchImpl,
            now,
            randomBytes,
            mintToken,
          });
          return json(result, 201, { origin });
        }

        if (url.pathname.startsWith("/v1/")) {
          // Browser image requests do not consistently send Origin. Permit its
          // omission only for the exact read-only managed-media preview route;
          // a supplied Origin is still allowlisted and the signed instructor
          // session remains mandatory.
          const managedMediaPreview = request.method === "GET" && /^\/v1\/media\/[A-Za-z0-9][A-Za-z0-9._:-]{0,199}\/versions\/[A-Za-z0-9][A-Za-z0-9._:-]{0,199}\/rights\/[A-Za-z0-9][A-Za-z0-9._:-]{0,199}:preview$/.test(url.pathname);
          origin = managedMediaPreview ? optionalAllowedOrigin(request, config) : requireAllowedOrigin(request, config);
          const session = await requireSession(request, config, now);
          if (contentMutationMethods.has(request.method)) requireCsrf(request, session);
          if (!["GET", "HEAD", ...contentMutationMethods].includes(request.method)) {
            throw new HttpError(405, "method_not_allowed", "This method is not supported by the content API gateway");
          }
          return await forwardContentApi(request, env, session, origin);
        }

        if (url.pathname === "/auth/logout") {
          if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
          origin = requireAllowedOrigin(request, config);
          const session = await requireSession(request, config, now);
          requireCsrf(request, session);
          return empty(204, {
            origin,
            headers: { "Set-Cookie": clearCookie(SESSION_COOKIE, "Strict") },
          });
        }

        throw new HttpError(404, "not_found", "The requested editor endpoint does not exist");
      } catch (error) {
        return safeErrorResponse(
          error,
          origin ?? safeAllowedOrigin(request, env),
          url.pathname === "/auth/callback",
        );
      }
    },
  };
}

const app = createEditorAuthApp();

export async function dispatchMediaJobs(batch, env, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const mintToken = dependencies.mintInstallationToken ?? mintInstallationToken;
  const token = await mintToken(env, { fetchImpl, now });
  for (const message of batch.messages) {
    const job = message.body;
    const valid = job?.schemaVersion === 1
      && /^mediajob_[A-Za-z0-9_-]{8,}$/.test(job.jobId ?? "")
      && /^jobs\/mediajob_[A-Za-z0-9_-]{8,}\/[a-f0-9]{64}\.json$/.test(job.envelopeObjectKey ?? "")
      && /^[a-f0-9]{64}$/.test(job.envelopeSha256 ?? "");
    if (!valid) { message.ack?.(); continue; }
    const response = await fetchImpl(`${GITHUB_API}/repos/${REPOSITORY.owner}/${REPOSITORY.name}/dispatches`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "PHIL-123-Media-Dispatcher",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: "media_process", client_payload: { job_id: job.jobId, envelope_key: job.envelopeObjectKey, envelope_sha256: job.envelopeSha256 } }),
    });
    if (response.status === 204) message.ack?.();
    else message.retry?.({ delaySeconds: Math.min(300, 15 * (message.attempts ?? 1)) });
  }
}

export async function scheduledCleanup(_event, env, dependencies = {}) {
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  return cleanupExpiredOAuthStates(env, now());
}

export default {
  fetch(request, env) {
    return app.fetch(request, env);
  },
  queue(batch, env) {
    return dispatchMediaJobs(batch, env);
  },
  scheduled(event, env, ctx) {
    const task = scheduledCleanup(event, env);
    if (ctx?.waitUntil) ctx.waitUntil(task);
    return task;
  },
};
