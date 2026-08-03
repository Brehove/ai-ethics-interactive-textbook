# Production deployment checklist

This is the operator checklist for the Chapter 7 canary. It records names and verification commands, never secret values. A checked code path is not a deployed service; record the deployment URL/version beside the step when it is actually complete.

## Already provisioned

- Cloudflare D1 database: `ai-ethics-content` (`1f82c4fa-228b-4cf7-9b40-ff10eebeadfb`).
- D1 migrations `0001`–`0008` and an idempotent 18-document shadow seed. Verify the remote migration table before treating this item as complete.
- Queue/DLQ pairs: `ai-ethics-media-jobs`, `ai-ethics-media-jobs-dlq`, `ai-ethics-release-jobs`, `ai-ethics-release-jobs-dlq`.
- GitHub environments:
  - `content-release-candidate`: `main` and `agent/agent-native-authoring` only;
  - `media-quarantine`: `main` only, no reviewer pause for signed queue jobs;
  - `content-production`: `main` only, required reviewer `Brehove`.
  - `content-backup`: `main` only, scheduled private D1 export, durable R2 mirror, clean-SQLite restore check, and age-encrypted GitHub artifact.
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

- editor/auth gateway: existing GitHub OAuth/App/session values, `RELEASE_SNAPSHOT_READ_TOKEN`, and `RELEASE_DEPLOY_RECEIPT_TOKEN`;
- textbook MCP: `MCP_CAPABILITY_SECRET` (at least 32 random bytes); keep `MCP_ALLOW_LEGACY_TOKEN=0`. Mint short-lived, per-agent capabilities with `node scripts/mcp/mint-agent-capability.mjs`; do not deploy a shared long-lived bearer token;
- Content API: `MEDIA_CALLBACK_SECRET` and `PREVIEW_TOKEN_SECRET`. `MEDIA_CALLBACK_SECRET` must match GitHub's `MEDIA_CALLBACK_TOKEN`; the names differ because one verifies and one signs. `PREVIEW_TOKEN_SECRET` is also set independently on the preview Worker and never sent to a browser. The release receipt credential terminates at the editor/auth gateway; the gateway derives the fixed service identity and never forwards the bearer token.

GitHub Actions secrets:

- `RELEASE_SIGNING_KEY` — already configured;
- `SUBMITTED_SNAPSHOT_READ_TOKEN` — exact same value as the gateway's `RELEASE_SNAPSHOT_READ_TOKEN`;
- `CLOUDFLARE_RELEASE_TOKEN` — least-privilege version upload/deploy token;
- `RELEASE_DEPLOY_RECEIPT_TOKEN` — exact same value as the editor/auth gateway secret, used only by the protected release job to stage and record deployment receipts;
- `MEDIA_R2_ACCESS_KEY_ID`, `MEDIA_R2_SECRET_ACCESS_KEY`, `MEDIA_CALLBACK_TOKEN`.
- `CLOUDFLARE_BACKUP_TOKEN` for read-only D1 export.
- `BACKUP_SOURCE_R2_ACCESS_KEY_ID`, `BACKUP_SOURCE_R2_SECRET_ACCESS_KEY` for read-only access to the three durable source buckets.
- `BACKUP_DEST_R2_ACCESS_KEY_ID`, `BACKUP_DEST_R2_SECRET_ACCESS_KEY` for read/write access only to `ai-ethics-backups`. The workflow deliberately uses separate S3 credentials because an R2 S3 token cannot express per-bucket read-only and write-only permissions in one credential.

GitHub Actions variables:

- `MEDIA_R2_ENDPOINT_URL`
- `MEDIA_R2_JOBS_BUCKET=ai-ethics-media-job-envelopes`
- `MEDIA_R2_QUARANTINE_BUCKET=ai-ethics-upload-quarantine`
- `MEDIA_R2_MEDIA_BUCKET=ai-ethics-content-media`
- `BACKUP_R2_ENDPOINT_URL`, `BACKUP_R2_BUCKET=ai-ethics-backups`
- `BACKUP_AGE_RECIPIENT` — the public `age1…` recipient for an offline-held recovery key. Never store the corresponding secret key in GitHub or Cloudflare.

Generate values locally, pass them directly to the secret commands, and do not place them in a repository file, shell history, issue, pull request, workflow input, or chat.

## Deployment order

1. Create/verify R2 buckets and lifecycle rules.
2. Apply all D1 migrations remotely and run the drift audit. Confirm `0013_deployment_recovery_version.sql` is applied before deploying the Content API code that stages releases.
3. Deploy the private Content API Worker and verify `/health` through a service binding.
4. Deploy the protected preview Worker; verify invalid, expired, and replayed tokens fail and responses are uncached/noindexed.
5. Set the shared media/release tokens, then deploy the editor/auth gateway.
6. Deploy the textbook MCP Worker and verify unauthenticated requests are rejected.
   Register the hosted MCP with `TEXTBOOK_MCP_ACCESS_TOKEN`, install the repository Skills, and verify a Keychain-backed `npm run codex:textbook` session sees `save_live_revision` only when its receipt includes `content:live-save` and `maySaveLive: true`.
7. Deploy the reader build containing `/admin/`; do not change the Chapter 7 authority record yet.
8. Run browser login, Chapter 7 read/edit/checkpoint/diff/preview/validate/submit tests.
9. Upload representative PNG/JPEG, animated GIF, WebP, MP3/WAV/M4A, MP4/WebM, PDF, and UTF-8 text fixtures through quarantine; verify exact private originals, public clean derivatives, callbacks, transcript equivalents/accessibility alternatives, and placement preview. Do not record timed-caption support unless a real caption track was supplied and tested.
10. Insert and activate one YouTube, Vimeo, and X fixture; verify no provider request occurs before explicit activation. Verify Spotify consent and SoundCloud/Bluesky/link-card fallbacks.
11. Run **Immutable content release** with `promote=false`; inspect the signed candidate, built asset digests, and canary preview.
12. Re-run the exact snapshot/revision/commit with `promote=true`, the exact `expected_active_release_id`, and the exact known-good `rollback_version_id`; then approve the `content-production` environment. The protected workflow records the receipt, activates the candidate's exact D1 entries, and runs the complete 18-document state audit.
13. Verify the live reader, no-JS, mobile, offline, print, CSP, cache headers, and checkpoint sidebar. Confirm `release-state-audit.json` reports `valid: true`, the expected Worker version, and `documentCount: 18`.
14. Configure `content-production-recovery` with only `CLOUDFLARE_RELEASE_TOKEN` and `RELEASE_DEPLOY_RECEIPT_TOKEN`, branch-restricted to `main`, and enable **Reconcile interrupted content release**. It may finish only an already staged, human-approved release or abandon one whose traffic never moved.
15. Run **Complete content release rollback** against the prior immutable release. Confirm its receipt atomically restores the pointer, all 18 authority entries, and every D1 canonical head, then confirm `rollback-state-audit.json` is valid before expanding beyond Chapter 7.
16. Verify the D1 release record exposes the completed deployment transaction, receipt hash, active-pointer history, exact Cloudflare version, and recovery-version binding.
17. Enable **Private content backup and restore check** on `main`, run it manually once, and verify the private R2 object/digest plus the encrypted 30-day GitHub artifact before relying on the schedule. Download one artifact, decrypt it with the offline age key, verify `r2-SHA256SUMS`, and restore its SQL into clean SQLite; record only the run URL and verification result.

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
npx wrangler deploy --dry-run --config workers/textbook-preview/wrangler.jsonc
```

After deployment, record Worker version IDs, snapshot/revision hashes, workflow run URLs, smoke results, and rollback evidence in the release provenance artifact. Never record tokens.
