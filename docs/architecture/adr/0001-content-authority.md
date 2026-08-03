# ADR 0001: Standalone editor with Cloudflare D1/R2 content authority

- Status: Accepted (Phase 0, 2026-08-02)
- Decision owners: Instructor and platform maintainers

## Context

Routine course-content edits need a browser workflow without Git commits, while public reading must remain a frozen static artifact. The originally proposed Sanity Content Lake/Studio path cannot meet the approved operating ceiling of **$5 per month**: Sanity's currently usable private tier is $15 per seat per month, while its free tier's public-only datasets and insufficient revision-history capability are not suitable for this textbook's private drafts, review, and restore requirements. Source: [Sanity pricing](https://www.sanity.io/pricing).

## Decision

Use a standalone Textbook Editor that speaks only to the Content API. Cloudflare D1 is the canonical authority for accepted structured editorial content, revisions, change sets, rights, approvals, and operational records; private Cloudflare R2 holds immutable uploaded media, snapshots, previews, exports, and release artifacts. Git remains the authority for code, contracts, schema migrations, renderers, validators, infrastructure, skills, and tests. Public reading is an immutable static Cloudflare release generated only from a validated, hash-pinned snapshot.

The API, not the editor or storage layer, allocates stable IDs, enforces validation, compare-and-swap, idempotency, audit lineage, and review/release gates. Git and D1 are never simultaneous routine content authorities for the same chapter. During migration Git remains authoritative until an explicitly approved per-chapter cutover to D1.

## Consequences

- Routine prose, checkpoint, media, caption, and embed edits require no Git commit.
- The platform avoids a required vendor spend above the $5/month ceiling, but owns editor UX, revision storage, and content-query implementation.
- D1 schema migrations and R2 retention/versioning become release-critical infrastructure.
- The provider-neutral `ChapterBundle`, `BookReleaseSnapshot`, MCP, and validation contracts remain intact; only their repository implementation changes.
- There is no live editorial-data request in the public reader and no public exposure of draft records or authoring credentials.

## Rollback

Before any chapter cutover, retain the Git fixture and its normalized snapshot hash. A failed canary restores that chapter's authority-registry entry to the prior Git source and republishes the prior immutable release. After cutover, restore a prior D1/R2 snapshot into a new revision/change set and publish it as a new release; do not mutate a historical release or rely on an external CMS export.
