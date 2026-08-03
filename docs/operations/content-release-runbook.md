# Immutable content release runbook

The reader remains on its current Cloudflare Worker version until every gate passes and a reviewer approves the `content-production` GitHub environment. A candidate is a signed, content-addressed manifest bound to one submitted D1 snapshot hash, its D1 snapshot revision, and one full Git commit SHA. Never use a mutable API endpoint, user-supplied URL, branch name, or an unpinned artifact as a release input.

## Canary scope and gates

Initial canary scope is deliberately narrow: only `chapter_ch07` may be D1-authoritative. All other D1-authoritative documents fail closed. Git authority remains allowed for the rest of the book. The candidate job accepts only the snapshot hash, constructs the fixed trusted gateway route for that hash, rejects redirects, verifies the returned bytes against the same SHA-256, and verifies the server-returned snapshot revision against the workflow input. It merges that Chapter 7 document into a full Git baseline snapshot and signs both bindings. It materializes the approved `chapter.md`, `reading-record.json`, safe typed placement sidecar, and only the snapshot's SHA-addressed cleared media derivatives in an isolated build workspace before generation, validation, and build. It records SHA-256 digests for all built assets. Any stale revision, hash/signature mismatch, unsigned manifest, missing media clearance, forbidden D1 authority, failed validation, preview route, no-JS reader, CSP, or asset digest check stops the release before traffic changes.

## Required protected environments

- `content-release-candidate` may upload an immutable Worker version but cannot move production traffic.
- `content-production` requires a human reviewer and contains the release/receipt credentials used for the approved promotion or explicit rollback.
- `content-production-recovery` is branch-restricted to `main`, contains only `CLOUDFLARE_RELEASE_TOKEN` and `RELEASE_DEPLOY_RECEIPT_TOKEN`, and has no general authoring credential. Its scheduled workflow may reconcile only a transaction the human-gated workflow already staged.

All production-changing workflows share the non-canceling `content-production-release` concurrency group. Never stage a second release while an earlier staged transaction exists, even after its ordinary ten-minute receipt deadline; the reconciler owns that state.

## Release

1. In the Textbook Editor, inspect the semantic diff and explicitly approve the exact snapshot for release. This records the immutable snapshot hash/revision; it does not publish.
2. In GitHub Actions, run **Immutable content release** with that submitted snapshot SHA-256, snapshot revision, and full approved commit SHA. Set `promote` to false first. The workflow derives the only permitted download URLs from hashes and the fixed `auth.ethicsandai.your-digital-life.org` gateway.
3. Review the candidate and deployment artifacts. Confirm Chapter 7 is the only D1-authoritative document and that the preview smoke result is green.
4. Re-run with the same three immutable inputs, the exact current `expected_active_release_id` (or `none` only for the first deployment), an exact known-good `rollback_version_id`, and `promote=true`. The `content-production` protected environment requires a manual reviewer approval.
5. The protected job stages a service-only D1 transaction containing distinct target and recovery Worker versions, moves Cloudflare traffic to the already-uploaded and already-smoke-tested version, runs production smoke checks, and records a hash-bound receipt. A trigger-enforced expected-active compare-and-swap advances the D1 pointer only when the receipt matches the staged candidate, attestation, snapshot, version, and prior active release.
6. The same workflow activates the candidate's exact D1 authority entries and calls `POST /v1/releases/{releaseId}:auditState`. The audit must confirm the active pointer, published state, exact Worker version, all 18 release/live authority bindings, and every D1 canonical revision/hash.
7. Inspect `GET /v1/releases/{releaseId}` and preserve the workflow URL plus candidate, deployment, verification, receipt, authority, state-audit, and provenance artifacts for 90 days. The evidence names the snapshot hash/revision, commit, manifest digest, target/recovery Worker versions, receipt hash, transaction, and pointer history.

The release workflow has one non-canceling concurrency lock. Do not run `wrangler deploy` directly for this service. Local commands are dry-run unless `RELEASE_EXECUTE=1`; tests use adapters and cannot call Cloudflare.

## Complete rollback

Use **Complete content release rollback**, never a standalone `wrangler rollback`, for an operational restore. Supply the exact prior `target_release_id` and current `expected_active_release_id`, then approve `content-production`. The workflow selects only a previously receipt-backed immutable Worker version, verifies production, and records a rollback receipt. In the same D1 transaction as the pointer command it restores the target release's complete 18-entry authority map and every D1 canonical head. `rollback-state-audit.json` must report `valid: true` before the rollback is complete.

If verification or receipt recording fails before D1 advances, the workflow restores the formerly active Worker version. If the receipt succeeds, never move Cloudflare alone: D1 is already authoritative for the new pointer. Use the reconciler and state audit instead.

## Interrupted-run reconciliation

**Reconcile interrupted content release** runs every ten minutes and can also be dispatched manually. It reads the one serialized staged transaction and actual Cloudflare deployment status:

- target version at exactly 100%: rerun production smoke, accept an expired transaction through the protected reconciliation receipt route, activate D1 authority for a forward promotion, and audit the full release state;
- recovery version at exactly 100%: record content-free verification evidence and abandon the untouched staged transaction;
- split traffic, an unknown version, a changed D1 pointer, a missing 18-entry map, or any hash mismatch: fail closed without changing D1.

When no staged transaction exists, the same workflow audits the active release. If a runner died after receipt recording but before authority activation, it replays only the active release's exact D1 authority map and audits again. This operation cannot choose another release or edit chapter content.

## Rollback drill

Run the drill quarterly through **Complete content release rollback** against a previously promoted release. Verify `/`, `/chapter/aristotle-character-and-ai-assisted-life/`, the exact active Worker version, receipt/pointer history, all 18 authority records, and every D1 canonical head. Do not rebuild or re-upload during rollback. A lower-level Worker-only rollback is diagnostic tooling, not a complete textbook restore, because it cannot reconcile D1 authority.

Target RTO is 15 minutes from rollback decision to restored traffic. RPO is zero for published reader content: rollback selects a previously immutable Worker version; no accepted snapshot is discarded or rewritten. If Cloudflare version promotion fails or is ambiguous, leave the active release untouched, capture the workflow output, and investigate before retrying.
