# Production deployment checklist

This is the operator checklist for the Chapter 7 canary. It records names and verification commands, never secret values. A checked code path is not a deployed service; record the deployment URL/version beside the step when it is actually complete.

## Already provisioned

- Cloudflare D1 database: `ai-ethics-content` (`1f82c4fa-228b-4cf7-9b40-ff10eebeadfb`).
- D1 migrations `0001`–`0005` and an idempotent 18-document shadow seed.
- Queue/DLQ pairs: `ai-ethics-media-jobs`, `ai-ethics-media-jobs-dlq`, `ai-ethics-release-jobs`, `ai-ethics-release-jobs-dlq`.
- GitHub environments:
  - `content-release-candidate`: `main` and `agent/agent-native-authoring` only;
  - `media-quarantine`: `main` only, no reviewer pause for signed queue jobs;
  - `content-production`: `main` only, required reviewer `Brehove`.
  - `content-backup`: `main` only, scheduled private D1 export and clean-SQLite restore check.
- Repository signing secret: `RELEASE_SIGNING_KEY`.

## Account-owner confirmation gate

Activate Cloudflare R2 only after the account owner explicitly accepts the subscription shown by Cloudflare, including usage overages. The operating budget remains capped at $5/month. Configure Cloudflare usage notifications/alerts before the canary receives routine uploads.

## R2 inventory

Create these private buckets exactly once:

- `ai-ethics-content-media`
- `ai-ethics-upload-quarantine`
- `ai-ethics-snapshots`
- `ai-ethics-release-artifacts`
- `ai-ethics-backups`
- `ai-ethics-media-job-envelopes`

Keep public development URLs disabled. Set a 24-hour lifecycle deletion rule on quarantine inputs and job envelopes after completion. Create one S3-compatible token limited to the quarantine, media, and job-envelope buckets for the GitHub media processor; do not reuse the account-wide Wrangler credential.

## Secret and variable wiring

Cloudflare Worker secrets:

- editor/auth gateway: existing GitHub OAuth/App/session values and `RELEASE_SNAPSHOT_READ_TOKEN`;
- textbook MCP: `MCP_ACCESS_TOKEN`;
- Content API: `MEDIA_CALLBACK_SECRET` and any separately documented service credential. Its value must match GitHub's `MEDIA_CALLBACK_TOKEN`; the names differ because one verifies and one signs.

GitHub Actions secrets:

- `RELEASE_SIGNING_KEY` — already configured;
- `SUBMITTED_SNAPSHOT_READ_TOKEN` — exact same value as the gateway's `RELEASE_SNAPSHOT_READ_TOKEN`;
- `CLOUDFLARE_RELEASE_TOKEN` — least-privilege version upload/deploy token;
- `MEDIA_R2_ACCESS_KEY_ID`, `MEDIA_R2_SECRET_ACCESS_KEY`, `MEDIA_CALLBACK_TOKEN`.
- `CLOUDFLARE_BACKUP_TOKEN`, `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY` for the private scheduled export only.

GitHub Actions variables:

- `MEDIA_R2_ENDPOINT_URL`
- `MEDIA_R2_JOBS_BUCKET=ai-ethics-media-job-envelopes`
- `MEDIA_R2_QUARANTINE_BUCKET=ai-ethics-upload-quarantine`
- `MEDIA_R2_MEDIA_BUCKET=ai-ethics-content-media`
- `CLOUDFLARE_RELEASE_PREVIEW_URL`
- `BACKUP_R2_ENDPOINT_URL`, `BACKUP_R2_BUCKET=ai-ethics-backups`

Generate values locally, pass them directly to the secret commands, and do not place them in a repository file, shell history, issue, pull request, workflow input, or chat.

## Deployment order

1. Create/verify R2 buckets and lifecycle rules.
2. Apply all D1 migrations remotely and run the drift audit.
3. Deploy the private Content API Worker and verify `/health` through a service binding.
4. Set the shared media/release tokens, then deploy the editor/auth gateway.
5. Deploy the textbook MCP Worker and verify unauthenticated requests are rejected.
6. Deploy the reader build containing `/admin/`; do not change the Chapter 7 authority record yet.
7. Run browser login, Chapter 7 read/edit/checkpoint/diff/validate/submit tests.
8. Upload one still image, one animated GIF, one short MP4, one short audio file, and one safe document through quarantine; verify immutable versions, callbacks, transcript equivalents/accessibility alternatives, and placement preview. Do not record timed-caption support unless a real caption track was supplied and tested.
9. Insert and activate one YouTube, Vimeo, and X fixture; verify no provider request occurs before explicit activation. Verify Spotify consent and SoundCloud/Bluesky/link-card fallbacks.
10. Run **Immutable content release** with `promote=false`; inspect the signed candidate, built asset digests, and canary preview.
11. Re-run the exact snapshot/revision/commit with `promote=true`, then approve the `content-production` environment.
12. Verify the live reader, no-JS, mobile, offline, print, CSP, cache headers, and checkpoint sidebar.
13. Only then switch `chapter_ch07` to its exact D1 revision/hash authority.
14. Run and record a rollback drill before expanding beyond Chapter 7.
15. Enable **Private content backup and restore check** on `main`, run it manually once, and verify the private R2 object/digest before relying on the schedule.

## Verification commands

Use Node 22 for every local or CI-equivalent command:

```bash
npm ci
npm run validate
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy --dry-run --config workers/editor-auth/wrangler.jsonc
npx wrangler deploy --dry-run --config workers/content-api/wrangler.jsonc
npx wrangler deploy --dry-run --config workers/textbook-mcp/wrangler.jsonc
```

After deployment, record Worker version IDs, snapshot/revision hashes, workflow run URLs, smoke results, and rollback evidence in the release provenance artifact. Never record tokens.
