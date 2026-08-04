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

Before the first auth deployment, apply both migrations in the dedicated
`ai-ethics-editor-auth-state` database. Migration `0002_oauth_pkce_states.sql`
stores only short-lived OAuth nonce hashes, server-side PKCE verifiers,
validated chapter targets, and expiry; the hourly Worker trigger removes
expired rows. It is not the content database and must never be bound to the
reader or editor static host.

Deploy it with:

```bash
npx wrangler deploy --config workers/editor-auth/wrangler.jsonc
```

The private GitHub App is `ai-ethics-editor-brehove`. It is installed only on `Brehove/ai-ethics-interactive-textbook` and limited to Contents and Pull requests read/write permissions; Metadata read is GitHub's mandatory baseline. Webhooks are disabled. The callback is exactly `https://auth.ethicsandai.your-digital-life.org/auth/callback`. Reader Edit links use only `GET /auth/start?chapter=<known-slug>&mode=edit&anchor=<safe-anchor>`; OAuth reconstructs a code-pinned editor chapter route and never accepts a `returnTo` URL.

## Codex MCP and Skills

Register the hosted MCP once:

```bash
codex mcp add ai-ethics-textbook \
  --url https://mcp.ethicsandai.your-digital-life.org/mcp \
  --bearer-token-env-var TEXTBOOK_MCP_ACCESS_TOKEN
```

Install the four directories under `.agents/skills/` into the user's Codex skills directory. The MCP uses short-lived, per-run capabilities; no shared bearer token belongs in Codex configuration. On macOS, store the Worker-matching signing secret in the login Keychain under service `ai-ethics-textbook-mcp-capability`, then start a Codex CLI session with:

```bash
npm run codex:textbook
```

The wrapper reads the signing secret without printing it, mints a 55-minute capability for a unique run, removes the signing secret from the child environment, and passes only the scoped bearer token to Codex. Start a new wrapped session to refresh an expired capability. The `content:live-save` scope exposes `save_live_revision`; the Skills may call it only when the user explicitly asks to save or publish immediately. It cannot approve, reject, change authority, promote a protected whole-site release, or roll back.

## Publication boundary

A successful reader deployment modifies only the public website. Canvas remains a separate, explicitly authorized course workflow. Git remains canonical for code and for chapters whose authority registry entry is `git`; routine browser/API editing begins only for a chapter whose exact D1 revision and normalized hash have been explicitly activated. Production promotion uses the protected release workflow and its recorded deployment receipt, never the direct Content API publish endpoint.
