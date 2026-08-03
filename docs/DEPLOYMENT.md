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

Deploy it with:

```bash
npx wrangler deploy --config workers/editor-auth/wrangler.jsonc
```

The private GitHub App is `ai-ethics-editor-brehove`. It is installed only on `Brehove/ai-ethics-interactive-textbook` and limited to Contents and Pull requests read/write permissions; Metadata read is GitHub's mandatory baseline. Webhooks are disabled. The callback is exactly `https://auth.ethicsandai.your-digital-life.org/auth/callback`.

## Publication boundary

A successful reader deployment modifies only the public website. Canvas remains a separate, explicitly authorized course workflow. The repository is canonical for textbook content and retains reviewed migration and rights records.
