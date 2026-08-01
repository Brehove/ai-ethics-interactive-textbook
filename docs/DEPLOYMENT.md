# Deployment

## Production topology

- Reader Worker: `ethicsandai`
- Reader origin: `https://ethicsandai.your-digital-life.org`
- Editor auth Worker: `ethicsandai-editor-auth`
- Editor auth origin: `https://auth.ethicsandai.your-digital-life.org`
- Canonical repository: `Brehove/ai-ethics-interactive-textbook`

The two public hostnames are custom domains in the existing `your-digital-life.org` Cloudflare zone. They are deliberately same-site so the editor can use its host-only, Secure, HttpOnly, `SameSite=Strict` session cookie. Do not replace the auth hostname with an unrelated `workers.dev` preview origin.

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

The GitHub App must be private to the owner, installed only on `Brehove/ai-ethics-interactive-textbook`, and limited to Contents and Pull requests read/write permissions. Webhooks are disabled. The callback is exactly `https://auth.ethicsandai.your-digital-life.org/auth/callback`.

## Publication boundary

A successful reader deployment does not modify Pressbooks. Pressbooks publication remains an explicit, separately authorized conversion-and-validation operation. The repository is canonical for website content and retains the reviewed migration and rights records.
