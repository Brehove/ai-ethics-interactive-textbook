# Repository-scoped editor authentication Worker

This Worker is the server-side boundary between the editor, GitHub, and agent capabilities. It stores no content, GitHub credential, browser session, or draft in Cloudflare. Its small D1 state database stores one-time OAuth nonce hashes and server-side PKCE verifiers, hashed device-verification secrets, non-secret capability claims, revocation state, and minimal audit data.

The implementation is pinned in code to `Brehove/ai-ethics-interactive-textbook`, to the `main` base branch, and to existing UTF-8 text files under `content/`. It has no merge, delete, publish, or direct-to-main endpoint.

## Browser contract

The admin bundle reads its service origin from `PUBLIC_EDITOR_AUTH_ORIGIN` and calls these endpoints with `credentials: "include"`:

### `GET /auth/start?chapter=<known-slug>&mode=edit&anchor=<optional-safe-anchor>`

Open as a top-level navigation. `chapter` must be one of the generated 18-route manifest entries; `mode` must be `edit`; `anchor`, when present, must match `^[A-Za-z][A-Za-z0-9._:-]{0,127}$`. Every other query key, including `returnTo`, is rejected. The Worker creates a short-lived signed state, stores its nonce hash and PKCE verifier in its dedicated D1 database, and redirects to GitHub with an S256 challenge. A valid existing instructor session redirects immediately to the exact editor target without visiting GitHub.

### `GET /auth/callback`

GitHub calls this endpoint. The Worker verifies the signed state and host-only state cookie, consumes the nonce exactly once with `DELETE ... RETURNING`, obtains the server-side PKCE verifier, and exchanges the one-time code server-side. It then verifies the numeric GitHub user allowlist and pinned repository access, discards the GitHub user token, sets an HttpOnly session cookie, and redirects only to `/chapter/<validated-slug>/?mode=edit#<validated-anchor>`. No GitHub credential is sent to editor JavaScript. Missing, expired, replayed, or unavailable state storage fails closed.

### `GET /api/session`

Required headers: exact allowed `Origin`. Returns:

```json
{
  "authenticated": true,
  "user": { "id": 123456, "login": "example" },
  "csrf_token": "short-lived-session-bound-token",
  "expires_at": 1785600000,
  "repository": {
    "owner": "Brehove",
    "name": "ai-ethics-interactive-textbook",
    "branch": "main"
  }
}
```

### `GET /api/file?path=content%2Fchapters%2F...%2Fchapter.md`

Required headers: exact allowed `Origin`. Returns the current main-branch file and both concurrency tokens:

```json
{
  "path": "content/chapters/example/chapter.md",
  "content": "# Canonical Markdown...",
  "blob_sha": "0123456789abcdef0123456789abcdef01234567",
  "base_commit_sha": "89abcdef0123456789abcdef0123456789abcdef",
  "branch": "main"
}
```

Only existing `.md`, `.yml`, `.yaml`, and `.json` files under `content/` are accepted. Binary assets, file creation, file deletion, hidden paths, traversal, and every other repository path are rejected.

### `POST /api/pull-requests`

Required headers: exact allowed `Origin`, `Content-Type: application/json`, and `X-Editor-CSRF` from `/api/session`.

```json
{
  "path": "content/chapters/example/chapter.md",
  "content": "# Revised canonical Markdown...",
  "base_commit_sha": "89abcdef0123456789abcdef0123456789abcdef",
  "blob_sha": "0123456789abcdef0123456789abcdef01234567",
  "commit_message": "Revise chapter introduction",
  "pull_request_title": "Revise chapter introduction",
  "pull_request_body": "Instructor-authored revision from the web editor."
}
```

The body is an exact schema. Repository, owner, target branch, source branch, merge, and publish controls are forbidden. The Worker checks the current `main` commit, checks the file blob, checks `main` a second time immediately before mutation, creates a server-named `editor/...` branch, commits to that branch, and opens a pull request targeting `main`.

Success is HTTP 201:

```json
{
  "pull_request": { "number": 17, "url": "https://github.com/Brehove/ai-ethics-interactive-textbook/pull/17" },
  "branch": "editor/chapter-20260801-a1b2c3d4e5f6",
  "base_commit_sha": "89abcdef0123456789abcdef0123456789abcdef",
  "commit_sha": "fedcba9876543210fedcba9876543210fedcba98"
}
```

A changed base returns HTTP 409 with `error: "stale_base"` and `current_base_commit_sha`. A changed file returns HTTP 409 with `error: "stale_file"` and `current_blob_sha`. The editor must reload and show a diff; it must never resubmit with a substituted SHA without instructor review.

### `POST /auth/logout`

Required headers: exact allowed `Origin` and `X-Editor-CSRF`. Clears the session cookie and returns HTTP 204.

## Codex MCP OAuth

Codex connects through standard OAuth discovery at
`/.well-known/oauth-authorization-server`. The authorization server supports
dynamic registration of public loopback clients, authorization code with PKCE
S256, 15-minute access tokens, rotating 30-day refresh tokens, and revocation.
GitHub establishes the allowlisted instructor identity. The baseline trusted
grant contains chapter and media editing scopes plus `content:live-save` and
the `commit_live` operation. The agent may use that operation only when the
user's current request explicitly says to Save or publish. Each live commit is
still validated, authority-checked, compare-and-swap guarded, idempotent,
immutable, attributed, audited, and delivery-verified.

OAuth grants created before trusted publishing was enabled retain their
original scopes during refresh. Revoke or reconnect the `ai-ethics-textbook`
MCP once to receive the trusted grant; there is no per-change approval after
that reconnect.

`request_live_save_authorization` remains as a compatibility route for older
grants. It creates a five-minute approval request bound to one exact changeset,
chapter, base revision, expected version, and idempotency key, and approval
issues a two-minute single-use `commit_live` capability. The current textbook
skills do not use that route.

The private service-binding entrypoint exposes `verifyCapability` plus the two
legacy Live Save authorization methods; none has a public HTTP route.

## Legacy agent-capability device flow

An MCP launcher creates a request with `POST /auth/agent-capability-requests`; this endpoint has no browser session requirement because it cannot grant any authority. The response contains a one-time device secret (returned once), a short user code, and the fixed verification URL. Requests expire after five minutes.

The instructor approves a request through `POST /auth/agent-capability-requests/{requestId}` with an allowed origin, signed GitHub session, CSRF header, matching user code, and `approve: true`. The agent polls `POST /auth/agent-capability-requests/{requestId}:exchange` with its device secret. Exchange is one-time.

Omitted scopes default to `content:read` and `content:write`, with a maximum 15-minute grant. This route remains for compatibility and conformance tests; the supported Codex workflow uses native OAuth. `content:live-save` is never implicit: it requires `content:write`, exact chapter IDs, the `commit_live` operation, an explicit `confirmLiveSave: true`, and a GitHub login no more than five minutes old. Issued Live Save capabilities are capped at two minutes. The instructor can revoke a grant with `POST /auth/agent-capabilities/{jti}:revoke` using the same session and CSRF boundary.

There is deliberately no HTTP token-verification route. Bound Workers use the private RPC entrypoint `AgentCapabilityVerifier.verifyCapability(token, target)`; it checks signature, expiry, persisted grant state, revocation, exact document, operation, and required scope.

## Configuration boundary

The repository owner, repository name, and base branch are committed in both code and Wrangler configuration. A mismatch fails closed. Configure these deployment-specific values only after the GitHub App, auth hostname, and reader hostname exist:

- `EDITOR_ALLOWED_ORIGINS`: comma-separated exact reader/editor origins; no wildcard.
- `EDITOR_AUTH_BASE_URL`: the exact auth origin, with no path.
- `EDITOR_ADMIN_URL`: the exact editor origin (the path is ignored for OAuth returns during the `/admin` transition).
- `EDITOR_CAPABILITY_VERIFICATION_URL`: the fixed editor page used for device-flow approval.
- `EDITOR_ALLOWED_GITHUB_USER_IDS`: comma-separated numeric IDs, not mutable login names.
- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_INSTALLATION_ID`

Set these as Cloudflare secrets; none belong in the repository:

- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `EDITOR_SESSION_SECRET`, generated from at least 32 random bytes.
- `AGENT_CAPABILITY_SIGNING_SECRET`, generated independently from at least 32 random bytes.

Using secrets for the deployment-specific non-secret IDs and origins is also acceptable and avoids a second uncommitted configuration channel. Local development may use an ignored `.dev.vars` file. Never commit that file.

The service deliberately has `workers_dev` and preview URLs disabled. Production requires a reviewed same-site auth hostname such as `auth.<reader-domain>` so the Strict session cookie works with the reader while remaining unavailable to cross-site requests.

## Local verification

From the repository root, with Node 22.12 or newer:

```text
npm ci
npm run test:editor-auth
npx wrangler deploy --dry-run --config workers/editor-auth/wrangler.jsonc
```

No real GitHub or Cloudflare credential is needed for the test suite or dry bundle.
