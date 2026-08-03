# Immutable content release runbook

The reader remains on its current Cloudflare Worker version until every gate passes and a reviewer approves the `content-production` GitHub environment. A candidate is a signed, content-addressed manifest bound to one submitted D1 snapshot hash, its D1 snapshot revision, and one full Git commit SHA. Never use a mutable API endpoint, user-supplied URL, branch name, or an unpinned artifact as a release input.

## Canary scope and gates

Initial canary scope is deliberately narrow: only `chapter_ch07` may be D1-authoritative. All other D1-authoritative documents fail closed. Git authority remains allowed for the rest of the book. The candidate job accepts only the snapshot hash, constructs the fixed trusted gateway route for that hash, rejects redirects, verifies the returned bytes against the same SHA-256, and verifies the server-returned snapshot revision against the workflow input. It merges that Chapter 7 document into a full Git baseline snapshot and signs both bindings. It materializes the approved `chapter.md`, `reading-record.json`, safe typed placement sidecar, and only the snapshot's SHA-addressed cleared media derivatives in an isolated build workspace before generation, validation, and build. It records SHA-256 digests for all built assets. Any stale revision, hash/signature mismatch, unsigned manifest, missing media clearance, forbidden D1 authority, failed validation, preview route, no-JS reader, CSP, or asset digest check stops the release before traffic changes.

## Release

1. In the Textbook Editor, inspect the semantic diff and explicitly approve the exact snapshot for release. This records the immutable snapshot hash/revision; it does not publish.
2. In GitHub Actions, run **Immutable content release** with that submitted snapshot SHA-256, snapshot revision, and full approved commit SHA. Set `promote` to false first. The workflow derives the only permitted download URLs from hashes and the fixed `auth.ethicsandai.your-digital-life.org` gateway.
3. Review the candidate and deployment artifacts. Confirm Chapter 7 is the only D1-authoritative document and that the preview smoke result is green.
4. Re-run with the same three immutable inputs, the exact current `expected_active_release_id` (or `none` only for the first deployment), an exact known-good `rollback_version_id`, and `promote=true`. The `content-production` protected environment requires a manual reviewer approval.
5. The protected job stages a service-only D1 transaction, moves Cloudflare traffic to the already-uploaded and already-smoke-tested version, runs production smoke checks, and records a hash-bound receipt. A trigger-enforced expected-active compare-and-swap advances the D1 pointer only when the receipt matches the staged candidate, attestation, snapshot, version, and prior active release.
6. Inspect `GET /v1/releases/{releaseId}` and preserve the workflow URL plus candidate, deployment, verification, receipt, and provenance artifacts for 90 days. The evidence names the snapshot hash/revision, commit, manifest digest, exact Worker version, receipt hash, transaction, and pointer history.

The release workflow has one non-canceling concurrency lock. Do not run `wrangler deploy` directly for this service. Local commands are dry-run unless `RELEASE_EXECUTE=1`; tests use adapters and cannot call Cloudflare.

## Rollback drill

Run the drill quarterly through the protected workflow against a previously promoted release. The service stages only a version already recorded in deployment receipts and applies the same expected-active compare-and-swap. The lower-level CLI remains useful for a controlled recovery test against a downloaded provenance artifact:

```bash
RELEASE_EXECUTE=1 node scripts/release/release-cli.mjs rollback \
  --version <exact-prior-worker-version-id> --state <downloaded-release-provenance.json> \
  --out rollback-provenance.json
```

The command refuses a version absent from the signed release history, promotes that exact prior version, and writes a new immutable rollback provenance record. Verify `/` and `/chapter/aristotle-character-and-ai-assisted-life/` immediately after. Do not rebuild or re-upload during rollback.

Target RTO is 15 minutes from rollback decision to restored traffic. RPO is zero for published reader content: rollback selects a previously immutable Worker version; no accepted snapshot is discarded or rewritten. If Cloudflare version promotion fails or is ambiguous, leave the active release untouched, capture the workflow output, and investigate before retrying.
