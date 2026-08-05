# Deployment

## Production topology

- Reader Worker: `ethicsandai`
- Reader origin: `https://ethicsandai.your-digital-life.org`
- Editor auth Worker: `ethicsandai-editor-auth`
- Editor auth origin: `https://auth.ethicsandai.your-digital-life.org`
- Protected preview Worker: `ai-ethics-textbook-preview`
- Protected preview origin: `https://preview.ethicsandai.your-digital-life.org`
- Content API Worker: `ethicsandai-content-api` (service binding only)
- Textbook MCP Worker: `ai-ethics-textbook-mcp`
- Canonical repository: `Brehove/ai-ethics-interactive-textbook`

The reader and auth hostnames are custom domains in the existing `your-digital-life.org` Cloudflare zone. They are deliberately same-site so the editor can use its host-only, Secure, HttpOnly, `SameSite=Strict` session cookie. The preview origin is separate and receives only a one-time snapshot token; it has no authoring cookie, Content API mutation scope, or public indexability.

The forward release, explicit rollback, and scheduled recovery workflows share the non-canceling `content-production-release` concurrency key. Every staged transaction stores both the target Worker version and the exact pre-promotion recovery version. The protected reconciler has only three permitted outcomes: finish the receipt when the target is 100% live, abandon the transaction when the recovery version is still 100% live, or fail closed on split/unknown traffic. A successful promotion or rollback is not complete until the service audit matches the active pointer, published release, all 18 frozen/live authority records, and each D1 canonical head.

## Reader deployment

Use Node 22, validate, and build before deploying:

```bash
npm ci
npm run validate
npm run build
npx wrangler deploy
```

`wrangler.jsonc` creates or updates the reader's Cloudflare custom domain. The site is static: no student data store, account system, analytics beacon, or server-rendered student route is deployed.

## Editor auth deployment

The auth Worker requires the non-secret runtime values listed in `workers/editor-auth/README.md` and these Cloudflare secrets:

- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `EDITOR_SESSION_SECRET`
- `RELEASE_SNAPSHOT_READ_TOKEN`
- `RELEASE_DEPLOY_RECEIPT_TOKEN`

Before the auth deployment, apply all migrations in the dedicated
`ai-ethics-editor-auth-state` database. Migration `0002_oauth_pkce_states.sql`
stores short-lived GitHub OAuth state. Migration `0003_mcp_oauth.sql` adds
public PKCE client registration, refreshable MCP grants, and exact Live Save
authorization bindings. This database is not the content database and must
never be bound to the reader or editor static host.

Deploy it with:

```bash
npx wrangler deploy --config workers/editor-auth/wrangler.jsonc
```

The private GitHub App is `ai-ethics-editor-brehove`. It is installed only on `Brehove/ai-ethics-interactive-textbook` and limited to Contents and Pull requests read/write permissions; Metadata read is GitHub's mandatory baseline. Webhooks are disabled. The callback is exactly `https://auth.ethicsandai.your-digital-life.org/auth/callback`. Reader Edit links use only `GET /auth/start?chapter=<known-slug>&mode=edit&anchor=<safe-anchor>`; OAuth reconstructs a code-pinned editor chapter route and never accepts a `returnTo` URL.

## Codex MCP and Skills

The versioned Codex plugin lives at `plugins/ai-ethics-textbook/`. It packages
the hosted MCP connection and the four AI Ethics Skills as one installable
unit. Install it from the repository marketplace in the Codex desktop app,
then select **Authenticate** for `ai-ethics-textbook`. Codex discovers the
authorization server, dynamically registers a public loopback client, uses
PKCE, opens GitHub sign-in, and stores/refreshes its OAuth grant. No access-token
environment variable or local signing secret is part of the supported flow.

For an MCP-only development registration, add the server and authenticate it:

```bash
codex mcp add ai-ethics-textbook \
  --url https://mcp.ethicsandai.your-digital-life.org/mcp
codex mcp login ai-ethics-textbook
```

The trusted OAuth grant can read, draft, preview, restore history as a new
draft, manage checkpoints and media, and call `commit_live` directly. The
grant includes the explicit `content:live-save` scope, and the MCP operation
allowlist must also include `commit_live`; either missing permission fails
closed. Agents may use that authority only when the user explicitly asks to
Save or publish. No additional per-change confirmation, code entry, or
single-use approval capability is required. Existing grants created before
the live-save scope was introduced must authenticate again once to receive it.

The legacy exact-revision approval route remains available for older clients,
but it is not part of the supported trusted-agent workflow.

Raw media bytes use the upload ticket returned by `upload_media`: a
short-lived, hash-, MIME-, size-, actor-, and single-use-bound capability. The
bundled media helper streams the local file with that one-time token and never
receives the standing OAuth bearer.

## Publication boundary

A successful reader deployment modifies only the public website. Canvas remains a separate, explicitly authorized course workflow. Git remains canonical for code and for chapters whose authority registry entry is `git`; routine browser/API editing begins only for a chapter whose exact D1 revision and normalized hash have been explicitly activated. Production promotion uses the protected release workflow and its recorded deployment receipt, never the direct Content API publish endpoint.
