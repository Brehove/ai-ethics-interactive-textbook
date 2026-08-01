import {
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

function safeAllowedOrigin(request, env) {
  try {
    const config = getRuntimeConfig(env);
    const origin = request.headers.get("Origin");
    return origin && config.origins.has(origin) ? origin : undefined;
  } catch {
    return undefined;
  }
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

function validateOAuthCode(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 512 || /\s/.test(value)) {
    throw new HttpError(400, "invalid_callback", "The GitHub callback is invalid");
  }
  return value;
}

export function createEditorAuthApp(dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch.bind(globalThis);
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

        const config = getRuntimeConfig(env);

        if (request.method === "OPTIONS" && (url.pathname.startsWith("/api/") || url.pathname === "/auth/logout")) {
          origin = requireAllowedOrigin(request, config);
          return empty(204, {
            origin,
            headers: {
              "Access-Control-Allow-Headers": "Content-Type, X-Editor-CSRF",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Max-Age": "600",
            },
          });
        }

        if (url.pathname === "/auth/start") {
          if (request.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET for this endpoint");
          const clientId = env.GITHUB_APP_CLIENT_ID;
          if (typeof clientId !== "string" || !clientId.trim()) throw new Error("GITHUB_APP_CLIENT_ID is not configured");
          const state = await signToken({
            v: 1,
            kind: "state",
            nonce: randomBase64Url(24, randomBytes),
            iat: now,
            exp: now + config.stateTtl,
          }, config.sessionSecret);
          const authorization = new URL(`${GITHUB_WEB}/login/oauth/authorize`);
          authorization.searchParams.set("client_id", clientId.trim());
          authorization.searchParams.set("redirect_uri", `${config.authBaseUrl}/auth/callback`);
          authorization.searchParams.set("state", state);
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
          if (!state || typeof state.nonce !== "string") {
            throw new HttpError(400, "state_expired", "The GitHub login state expired");
          }

          const code = validateOAuthCode(url.searchParams.get("code"));
          const userToken = await exchangeOAuthCode(env, code, `${config.authBaseUrl}/auth/callback`, fetchImpl);
          const user = await getAuthenticatedUser(userToken, fetchImpl);
          if (!config.allowedUserIds.has(String(user.id))) {
            throw new HttpError(403, "user_not_allowed", "This GitHub account is not an editor");
          }
          await verifyUserRepositoryAccess(env, userToken, fetchImpl);

          const csrf = randomBase64Url(24, randomBytes);
          const session = await signToken({
            v: 1,
            kind: "session",
            sub: String(user.id),
            login: user.login,
            csrf,
            iat: now,
            exp: now + config.sessionTtl,
          }, config.sessionSecret);
          const destination = new URL(config.adminUrl);
          destination.searchParams.set("editor_auth", "ok");
          return redirect(destination.href, {
            cookies: [
              cookie(SESSION_COOKIE, session, { maxAge: config.sessionTtl, sameSite: "Strict" }),
              clearCookie(STATE_COOKIE, "Lax"),
            ],
          });
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

export default {
  fetch(request, env) {
    return app.fetch(request, env);
  },
};
