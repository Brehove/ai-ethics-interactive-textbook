# ADR 0005: Publish only immutable static releases

- Status: Accepted (Phase 0, 2026-08-02)

## Context

The public reader must preserve no-storage student privacy, work offline/no-JS, and never expose mutable draft content. A database-backed reader would weaken atomic release and rollback behavior.

## Decision

Create a complete normalized snapshot in private R2 before review/publish. A signed candidate manifest pins D1 revision IDs/hashes, media objects, embed fallbacks, rights/approval records, renderer/code provenance, and derivative versions. The protected build reads only that snapshot, emits content-addressed first-party assets, validates every projection, and promotes one immutable Cloudflare static deployment. The public reader never queries D1/R2 editorial APIs at page view.

## Consequences

- Failed or stale builds cannot partially change a chapter.
- Rollback is a serialized complete-release pointer/deployment change and is targetable within five minutes.
- Snapshot, artifact, attestation, receipt, and active-pointer history require retention and restore drills.

## Rollback

Use the release lock and expected-active-release compare-and-swap to promote the prior verified deployment/manifest. If artifact recovery is required, rebuild from the prior R2 snapshot and pinned code provenance; do not reconstruct from current mutable D1 rows.
