# Repository-scoped editor authentication Worker

This Worker is the server-side boundary between the static `/admin/` interface and GitHub. It is stateless: it stores no content, access tokens, drafts, or sessions in Cloudflare KV, D1, R2, Durable Objects, or browser storage. GitHub intentionally stores the branch, commit, and pull request created by an authenticated save.

The implementation is pinned in code to `Brehove/ai-ethics-interactive-textbook`, to the `main` base branch, and to existing UTF-8 text files under `content/`. It has no merge, delete, publish, or direct-to-main endpoint.

## Browser contract

The admin bundle reads its service origin from `PUBLIC_EDITOR_AUTH_ORIGIN` and calls these endpoints with `credentials: "include"`:

### `GET /auth/start`

Open as a top-level navigation. The Worker creates a short-lived signed state cookie and redirects to the GitHub App authorization page. The return location is fixed by `EDITOR_ADMIN_URL`; the browser cannot supply an arbitrary redirect.

### `GET /auth/callback`

GitHub calls this endpoint. The Worker validates the state cookie, exchanges the one-time code server-side, verifies the numeric GitHub user allowlist, and confirms that the user/App combination can access the pinned repository. It then discards the GitHub user token, sets an HttpOnly session cookie, and redirects to the fixed admin URL. No GitHub credential is sent to the admin JavaScript.

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
  "commit_message": "Revise the First Read introduction",
  "pull_request_title": "Revise the First Read introduction",
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

## Configuration boundary

The repository owner, repository name, and base branch are committed in both code and Wrangler configuration. A mismatch fails closed. Configure these deployment-specific values only after the GitHub App, auth hostname, and reader hostname exist:

- `EDITOR_ALLOWED_ORIGINS`: comma-separated exact reader/admin origins; no wildcard.
- `EDITOR_AUTH_BASE_URL`: the exact auth origin, with no path.
- `EDITOR_ADMIN_URL`: the fixed reader admin URL, normally ending in `/admin/`.
- `EDITOR_ALLOWED_GITHUB_USER_IDS`: comma-separated numeric IDs, not mutable login names.
- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_INSTALLATION_ID`

Set these as Cloudflare secrets; none belong in the repository:

- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `EDITOR_SESSION_SECRET`, generated from at least 32 random bytes.

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
