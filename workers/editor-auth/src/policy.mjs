import {
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_STATE_TTL_SECONDS,
  EDITABLE_EXTENSIONS,
  EDITABLE_PATH_PREFIX,
  MAX_CONTENT_BYTES,
  MAX_SESSION_TTL_SECONDS,
  MAX_STATE_TTL_SECONDS,
  REPOSITORY,
} from "./constants.mjs";

const encoder = new TextEncoder();

export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function requireString(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is not configured`);
  }
  return value.trim();
}

function boundedInteger(value, fallback, minimum, maximum, name) {
  const parsed = value === undefined || value === "" ? fallback : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function parseHttpsOrigin(value, name, { allowLocalhost = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  const local = allowLocalhost && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error(`${name} must use HTTPS`);
  if (url.username || url.password || url.search || url.hash) throw new Error(`${name} contains forbidden URL components`);
  return url;
}

export function getRepositoryConfig(env) {
  const declaredOwner = env.EDITOR_REPO_OWNER ?? REPOSITORY.owner;
  const declaredName = env.EDITOR_REPO_NAME ?? REPOSITORY.name;
  const declaredBranch = env.EDITOR_DEFAULT_BRANCH ?? REPOSITORY.branch;
  if (
    declaredOwner !== REPOSITORY.owner
    || declaredName !== REPOSITORY.name
    || declaredBranch !== REPOSITORY.branch
  ) {
    throw new Error("The editor repository allowlist does not match the code-pinned repository");
  }
  return REPOSITORY;
}

export function getRuntimeConfig(env) {
  const sessionSecret = requireString(env, "EDITOR_SESSION_SECRET");
  if (encoder.encode(sessionSecret).byteLength < 32) {
    throw new Error("EDITOR_SESSION_SECRET must contain at least 32 UTF-8 bytes");
  }

  const origins = new Set(
    requireString(env, "EDITOR_ALLOWED_ORIGINS")
      .split(",")
      .map((origin) => parseHttpsOrigin(origin.trim(), "EDITOR_ALLOWED_ORIGINS entry", { allowLocalhost: true }).origin),
  );
  if (!origins.size) throw new Error("At least one editor origin is required");

  const allowedUserIds = new Set(
    requireString(env, "EDITOR_ALLOWED_GITHUB_USER_IDS")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  if (!allowedUserIds.size || [...allowedUserIds].some((id) => !/^\d+$/.test(id))) {
    throw new Error("EDITOR_ALLOWED_GITHUB_USER_IDS must contain numeric GitHub user IDs");
  }

  const authBaseUrl = parseHttpsOrigin(requireString(env, "EDITOR_AUTH_BASE_URL"), "EDITOR_AUTH_BASE_URL", { allowLocalhost: true });
  if (authBaseUrl.pathname !== "/") throw new Error("EDITOR_AUTH_BASE_URL must be an origin without a path");

  const adminUrl = parseHttpsOrigin(requireString(env, "EDITOR_ADMIN_URL"), "EDITOR_ADMIN_URL", { allowLocalhost: true });
  if (!origins.has(adminUrl.origin)) throw new Error("EDITOR_ADMIN_URL origin must be in EDITOR_ALLOWED_ORIGINS");

  return {
    repository: getRepositoryConfig(env),
    sessionSecret,
    origins,
    allowedUserIds,
    authBaseUrl: authBaseUrl.origin,
    // The legacy name remains in deployment configuration during the move from
    // /admin.  OAuth never uses its path: every post-login destination is
    // reconstructed from the route manifest on this exact editor origin.
    editorOrigin: adminUrl.origin,
    stateTtl: boundedInteger(env.EDITOR_STATE_TTL_SECONDS, DEFAULT_STATE_TTL_SECONDS, 60, MAX_STATE_TTL_SECONDS, "EDITOR_STATE_TTL_SECONDS"),
    sessionTtl: boundedInteger(env.EDITOR_SESSION_TTL_SECONDS, DEFAULT_SESSION_TTL_SECONDS, 300, MAX_SESSION_TTL_SECONDS, "EDITOR_SESSION_TTL_SECONDS"),
  };
}

export function requireAllowedOrigin(request, config) {
  const origin = request.headers.get("Origin");
  if (!origin || !config.origins.has(origin)) {
    throw new HttpError(403, "origin_not_allowed", "The request origin is not allowed");
  }
  return origin;
}

export function validateEditablePath(value) {
  if (typeof value !== "string" || value.length < EDITABLE_PATH_PREFIX.length || value.length > 300) {
    throw new HttpError(400, "invalid_path", "The content path is invalid");
  }
  if (value.includes("\\") || value.startsWith("/") || value.endsWith("/") || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new HttpError(400, "invalid_path", "The content path is invalid");
  }
  const segments = value.split("/");
  if (
    !value.startsWith(EDITABLE_PATH_PREFIX)
    || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.startsWith(".") || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment))
  ) {
    throw new HttpError(400, "invalid_path", "Only allowlisted public content files may be edited");
  }
  const extensionMatch = value.match(/(\.[A-Za-z0-9]+)$/);
  if (!extensionMatch || !EDITABLE_EXTENSIONS.has(extensionMatch[1].toLowerCase())) {
    throw new HttpError(400, "invalid_path", "This file type is not editable in the browser");
  }
  return value;
}

function validateSha(value, field) {
  if (typeof value !== "string" || !/^[a-f0-9]{40,64}$/i.test(value)) {
    throw new HttpError(400, "invalid_request", `${field} must be a Git object SHA`);
  }
  return value.toLowerCase();
}

function validateBoundedText(value, field, { minimum = 0, maximum }) {
  if (typeof value !== "string") throw new HttpError(400, "invalid_request", `${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed)) {
    throw new HttpError(400, "invalid_request", `${field} has an invalid length or control character`);
  }
  return trimmed;
}

export function validatePullRequestInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "invalid_request", "The request body must be a JSON object");
  }
  const required = ["path", "content", "base_commit_sha", "blob_sha", "commit_message", "pull_request_title"];
  const optional = ["pull_request_body"];
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(input);
  const unknown = keys.filter((key) => !allowed.has(key));
  const missing = required.filter((key) => !Object.hasOwn(input, key));
  if (unknown.length || missing.length) {
    throw new HttpError(400, "invalid_request", "The request contains missing or forbidden control fields", {
      ...(missing.length ? { missing } : {}),
      ...(unknown.length ? { unknown } : {}),
    });
  }

  if (typeof input.content !== "string") throw new HttpError(400, "invalid_request", "content must be text");
  if (encoder.encode(input.content).byteLength > MAX_CONTENT_BYTES) {
    throw new HttpError(413, "content_too_large", "The edited file exceeds the browser-editor limit");
  }

  return {
    path: validateEditablePath(input.path),
    content: input.content,
    baseCommitSha: validateSha(input.base_commit_sha, "base_commit_sha"),
    blobSha: validateSha(input.blob_sha, "blob_sha"),
    commitMessage: validateBoundedText(input.commit_message, "commit_message", { minimum: 5, maximum: 160 }),
    pullRequestTitle: validateBoundedText(input.pull_request_title, "pull_request_title", { minimum: 5, maximum: 160 }),
    pullRequestBody: Object.hasOwn(input, "pull_request_body")
      ? validateBoundedText(input.pull_request_body, "pull_request_body", { maximum: 5000 })
      : "Created by the repository-scoped PHIL 123 textbook editor.",
  };
}
