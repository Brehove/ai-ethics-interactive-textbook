import assert from "node:assert/strict";
import { generateKeyPairSync, verify as verifySignature } from "node:crypto";
import test from "node:test";

import {
  SESSION_COOKIE,
  STATE_COOKIE,
} from "../src/constants.mjs";
import {
  base64UrlToBytes,
  createGitHubAppJwt,
  signToken,
  verifyToken,
} from "../src/crypto.mjs";
import { createEditorAuthApp } from "../src/index.mjs";
import { validateEditablePath } from "../src/policy.mjs";

const NOW = 1_785_600_000;
const BASE_SHA = "a".repeat(40);
const BLOB_SHA = "b".repeat(40);
const COMMIT_SHA = "c".repeat(40);
const SESSION_SECRET = "test-only-session-secret-which-is-longer-than-thirty-two-bytes";
const TEST_CLIENT_SECRET = ["test", "only", "client", "secret"].join("-");
const READER_ORIGIN = "https://reader.example.test";
const AUTH_ORIGIN = "https://auth.example.test";

function runtimeEnv(overrides = {}) {
  return {
    EDITOR_REPO_OWNER: "Brehove",
    EDITOR_REPO_NAME: "ai-ethics-interactive-textbook",
    EDITOR_DEFAULT_BRANCH: "main",
    EDITOR_ALLOWED_ORIGINS: READER_ORIGIN,
    EDITOR_AUTH_BASE_URL: AUTH_ORIGIN,
    EDITOR_ADMIN_URL: `${READER_ORIGIN}/admin/`,
    EDITOR_ALLOWED_GITHUB_USER_IDS: "123456",
    EDITOR_SESSION_SECRET: SESSION_SECRET,
    EDITOR_STATE_TTL_SECONDS: "600",
    EDITOR_SESSION_TTL_SECONDS: "3600",
    GITHUB_APP_ID: "99999",
    GITHUB_APP_CLIENT_ID: "Iv1.test-client",
    GITHUB_APP_CLIENT_SECRET: TEST_CLIENT_SECRET,
    GITHUB_APP_INSTALLATION_ID: "77777",
    ...overrides,
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sessionFixture(overrides = {}) {
  const payload = {
    v: 1,
    kind: "session",
    sub: "123456",
    login: "instructor",
    csrf: "test-csrf-token",
    iat: NOW - 10,
    exp: NOW + 1800,
    ...overrides,
  };
  return { payload, token: await signToken(payload, SESSION_SECRET) };
}

function apiRequest(path, token, init = {}) {
  return new Request(`${AUTH_ORIGIN}${path}`, {
    ...init,
    headers: {
      Origin: READER_ORIGIN,
      Cookie: `${SESSION_COOKIE}=${token}`,
      ...(init.headers ?? {}),
    },
  });
}

function deterministicBytes(length) {
  return new Uint8Array(length).fill(0x2a);
}

test("signed sessions reject tampering and expiry", async () => {
  const { token } = await sessionFixture();
  assert.equal((await verifyToken(token, SESSION_SECRET, { kind: "session", now: NOW })).login, "instructor");
  assert.equal(await verifyToken(`${token.slice(0, -1)}x`, SESSION_SECRET, { kind: "session", now: NOW }), null);
  assert.equal(await verifyToken(token, SESSION_SECRET, { kind: "session", now: NOW + 4000 }), null);
});

test("GitHub App JWT signs with a generated PKCS#1 private key", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ format: "pem", type: "pkcs1" }).toString();
  const jwt = await createGitHubAppJwt({ appId: "99999", privateKey: pem, now: NOW });
  const [header, payload, signature] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString("utf8")), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")), {
    iat: NOW - 60,
    exp: NOW + 540,
    iss: "99999",
  });
  assert.equal(
    verifySignature("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(base64UrlToBytes(signature))),
    true,
  );
});

test("editable paths are constrained to public text content", () => {
  assert.equal(validateEditablePath("content/chapters/example/chapter.md"), "content/chapters/example/chapter.md");
  for (const path of [
    "../content/chapter.md",
    "/content/chapter.md",
    "content/../package.json",
    "content/chapters/example/image.png",
    "workers/editor-auth/src/index.mjs",
    "content/.hidden/file.md",
    "content\\chapters\\chapter.md",
  ]) {
    assert.throws(() => validateEditablePath(path), { name: "HttpError" });
  }
});

test("API rejects a foreign Origin without reflecting it", async () => {
  const { token } = await sessionFixture();
  const app = createEditorAuthApp({ now: () => NOW });
  const response = await app.fetch(new Request(`${AUTH_ORIGIN}/api/session`, {
    headers: { Origin: "https://attacker.example", Cookie: `${SESSION_COOKIE}=${token}` },
  }), runtimeEnv());
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});

test("callback rejects mismatched state before any GitHub request", async () => {
  let fetchCalls = 0;
  const app = createEditorAuthApp({
    now: () => NOW,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("must not fetch");
    },
  });
  const response = await app.fetch(new Request(`${AUTH_ORIGIN}/auth/callback?code=valid-code&state=wrong`, {
    headers: { Cookie: `${STATE_COOKIE}=different` },
  }), runtimeEnv());
  assert.equal(response.status, 400);
  assert.equal(fetchCalls, 0);
  assert.match(response.headers.get("Set-Cookie") ?? "", new RegExp(`${STATE_COOKIE}=;`));
});

test("callback keeps GitHub tokens server-side and creates a hardened session", async () => {
  const state = await signToken({
    v: 1,
    kind: "state",
    nonce: "state-nonce",
    iat: NOW - 10,
    exp: NOW + 300,
  }, SESSION_SECRET);
  const seen = [];
  const app = createEditorAuthApp({
    now: () => NOW,
    randomBytes: deterministicBytes,
    fetchImpl: async (url, init) => {
      seen.push({ url: String(url), init });
      if (String(url).endsWith("/login/oauth/access_token")) return jsonResponse({ access_token: "server-only-user-token" });
      if (String(url).endsWith("/user")) return jsonResponse({ id: 123456, login: "instructor" });
      if (String(url).includes("/repos/Brehove/ai-ethics-interactive-textbook")) {
        return jsonResponse({ full_name: "Brehove/ai-ethics-interactive-textbook", archived: false, disabled: false });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  });
  const callback = new URL(`${AUTH_ORIGIN}/auth/callback`);
  callback.searchParams.set("code", "valid-auth-code");
  callback.searchParams.set("state", state);
  const response = await app.fetch(new Request(callback, {
    headers: { Cookie: `${STATE_COOKIE}=${state}` },
  }), runtimeEnv());

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), `${READER_ORIGIN}/admin/?editor_auth=ok`);
  const cookies = response.headers.get("Set-Cookie") ?? "";
  assert.match(cookies, new RegExp(`${SESSION_COOKIE}=`));
  assert.match(cookies, /Secure/);
  assert.match(cookies, /HttpOnly/);
  assert.match(cookies, /SameSite=Strict/);
  assert.doesNotMatch(cookies, /server-only-user-token/);
  assert.equal(seen.length, 3);
});

test("file read returns the two optimistic-concurrency SHAs", async () => {
  const { token } = await sessionFixture();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/git/ref/heads/main")) return jsonResponse({ object: { sha: BASE_SHA } });
    if (String(url).includes("/contents/content/chapters/example/chapter.md")) {
      const content = "# Exact Markdown\n";
      return jsonResponse({
        type: "file",
        sha: BLOB_SHA,
        encoding: "base64",
        content: Buffer.from(content).toString("base64"),
        size: Buffer.byteLength(content),
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  const app = createEditorAuthApp({
    now: () => NOW,
    fetchImpl,
    mintInstallationToken: async () => "installation-token",
  });
  const response = await app.fetch(apiRequest("/api/file?path=content%2Fchapters%2Fexample%2Fchapter.md", token), runtimeEnv());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    path: "content/chapters/example/chapter.md",
    content: "# Exact Markdown\n",
    blob_sha: BLOB_SHA,
    base_commit_sha: BASE_SHA,
    branch: "main",
  });
  assert.equal(calls.length, 2);
});

test("save rejects a stale main branch before any mutation", async () => {
  const { payload, token } = await sessionFixture();
  const calls = [];
  const app = createEditorAuthApp({
    now: () => NOW,
    mintInstallationToken: async () => "installation-token",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ object: { sha: "d".repeat(40) } });
    },
  });
  const response = await app.fetch(apiRequest("/api/pull-requests", token, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Editor-CSRF": payload.csrf },
    body: JSON.stringify({
      path: "content/chapters/example/chapter.md",
      content: "# Revised\n",
      base_commit_sha: BASE_SHA,
      blob_sha: BLOB_SHA,
      commit_message: "Revise chapter introduction",
      pull_request_title: "Revise chapter introduction",
      pull_request_body: "Review the changed reasoning.",
    }),
  }), runtimeEnv());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "stale_base");
  assert.equal(calls.length, 1);
  assert.equal(calls.some((call) => ["POST", "PUT", "DELETE"].includes(call.init.method)), false);
});

test("save rejects a stale blob before creating a branch", async () => {
  const { payload, token } = await sessionFixture();
  const calls = [];
  const app = createEditorAuthApp({
    now: () => NOW,
    mintInstallationToken: async () => "installation-token",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/git/ref/heads/main")) return jsonResponse({ object: { sha: BASE_SHA } });
      return jsonResponse({ type: "file", sha: "e".repeat(40), encoding: "base64", content: "Iw==", size: 1 });
    },
  });
  const response = await app.fetch(apiRequest("/api/pull-requests", token, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Editor-CSRF": payload.csrf },
    body: JSON.stringify({
      path: "content/chapters/example/chapter.md",
      content: "# Revised\n",
      base_commit_sha: BASE_SHA,
      blob_sha: BLOB_SHA,
      commit_message: "Revise chapter introduction",
      pull_request_title: "Revise chapter introduction",
      pull_request_body: "",
    }),
  }), runtimeEnv());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "stale_file");
  assert.equal(calls.some((call) => ["POST", "PUT", "DELETE"].includes(call.init.method)), false);
});

test("save rejects browser-supplied repository or branch controls", async () => {
  const { payload, token } = await sessionFixture();
  let mintCalls = 0;
  const app = createEditorAuthApp({
    now: () => NOW,
    mintInstallationToken: async () => {
      mintCalls += 1;
      return "installation-token";
    },
  });
  const response = await app.fetch(apiRequest("/api/pull-requests", token, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Editor-CSRF": payload.csrf },
    body: JSON.stringify({
      path: "content/chapters/example/chapter.md",
      content: "# Revised\n",
      base_commit_sha: BASE_SHA,
      blob_sha: BLOB_SHA,
      commit_message: "Revise chapter introduction",
      pull_request_title: "Revise chapter introduction",
      pull_request_body: "",
      owner: "attacker",
      repository: "other",
      base: "main",
      branch: "main",
    }),
  }), runtimeEnv());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_request");
  assert.equal(mintCalls, 0);
});

test("save creates only a server-named branch, file commit, and PR to main", async () => {
  const { payload, token } = await sessionFixture();
  const calls = [];
  const fetchImpl = async (url, init) => {
    const call = { url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    if (call.url.includes("/git/ref/heads/main")) return jsonResponse({ object: { sha: BASE_SHA } });
    if (call.url.includes("/contents/content/chapters/example/chapter.md") && call.method === "GET") {
      return jsonResponse({ type: "file", sha: BLOB_SHA, encoding: "base64", content: "Iw==", size: 1 });
    }
    if (call.url.endsWith("/git/refs") && call.method === "POST") return jsonResponse({ ref: call.body.ref }, 201);
    if (call.url.includes("/contents/content/chapters/example/chapter.md") && call.method === "PUT") {
      return jsonResponse({ commit: { sha: COMMIT_SHA } });
    }
    if (call.url.endsWith("/pulls") && call.method === "POST") {
      return jsonResponse({ number: 17, html_url: "https://github.com/Brehove/ai-ethics-interactive-textbook/pull/17" }, 201);
    }
    throw new Error(`Unexpected ${call.method} ${call.url}`);
  };
  const app = createEditorAuthApp({
    now: () => NOW,
    randomBytes: deterministicBytes,
    fetchImpl,
    mintInstallationToken: async () => "installation-token",
  });
  const response = await app.fetch(apiRequest("/api/pull-requests", token, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Editor-CSRF": payload.csrf },
    body: JSON.stringify({
      path: "content/chapters/example/chapter.md",
      content: "# Revised\n",
      base_commit_sha: BASE_SHA,
      blob_sha: BLOB_SHA,
      commit_message: "Revise chapter introduction",
      pull_request_title: "Revise chapter introduction",
      pull_request_body: "Review the exact Markdown diff.",
    }),
  }), runtimeEnv());
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.pull_request.number, 17);
  assert.match(result.branch, /^editor\/chapter-\d{8}-[a-f0-9]{12}$/);

  const mutating = calls.filter((call) => ["POST", "PUT", "DELETE"].includes(call.method));
  assert.deepEqual(mutating.map((call) => call.method), ["POST", "PUT", "POST"]);
  assert.equal(mutating[0].body.ref, `refs/heads/${result.branch}`);
  assert.equal(mutating[0].body.sha, BASE_SHA);
  assert.equal(mutating[1].body.branch, result.branch);
  assert.notEqual(mutating[1].body.branch, "main");
  assert.equal(mutating[1].body.sha, BLOB_SHA);
  assert.equal(mutating[2].body.head, result.branch);
  assert.equal(mutating[2].body.base, "main");
  assert.equal(mutating[2].body.maintainer_can_modify, false);
});

test("a PR creation failure cleans up only the new editor branch", async () => {
  const { payload, token } = await sessionFixture();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    if (String(url).includes("/git/ref/heads/main")) return jsonResponse({ object: { sha: BASE_SHA } });
    if (String(url).includes("/contents/") && init.method === "GET") {
      return jsonResponse({ type: "file", sha: BLOB_SHA, encoding: "base64", content: "Iw==", size: 1 });
    }
    if (String(url).endsWith("/git/refs")) return jsonResponse({}, 201);
    if (String(url).includes("/contents/") && init.method === "PUT") return jsonResponse({ commit: { sha: COMMIT_SHA } });
    if (String(url).endsWith("/pulls")) return jsonResponse({ message: "failure" }, 500);
    if (String(url).includes("/git/refs/heads/editor/") && init.method === "DELETE") return new Response(null, { status: 204 });
    throw new Error(`Unexpected ${init.method} ${url}`);
  };
  const app = createEditorAuthApp({
    now: () => NOW,
    randomBytes: deterministicBytes,
    fetchImpl,
    mintInstallationToken: async () => "installation-token",
  });
  const response = await app.fetch(apiRequest("/api/pull-requests", token, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Editor-CSRF": payload.csrf },
    body: JSON.stringify({
      path: "content/chapters/example/chapter.md",
      content: "# Revised\n",
      base_commit_sha: BASE_SHA,
      blob_sha: BLOB_SHA,
      commit_message: "Revise chapter introduction",
      pull_request_title: "Revise chapter introduction",
      pull_request_body: "",
    }),
  }), runtimeEnv());
  assert.equal(response.status, 502);
  const deletes = calls.filter((call) => call.method === "DELETE");
  assert.equal(deletes.length, 1);
  assert.match(deletes[0].url, /\/git\/refs\/heads\/editor\//);
  assert.doesNotMatch(deletes[0].url, /\/heads\/main$/);
});
