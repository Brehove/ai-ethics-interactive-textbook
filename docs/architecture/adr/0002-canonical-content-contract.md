# ADR 0002: One provider-neutral canonical content contract

- Status: Accepted (Phase 0, 2026-08-02)

## Context

The existing book has stable passage and section IDs, raw legacy structures, reading-record checkpoints, rights metadata, and multiple derived outputs. Separate handwritten editor, API, storage, renderer, and MCP models would drift and make migration unsafe.

## Decision

Maintain one versioned TypeScript contract package. It defines `ChapterBundle`, `BookReleaseSnapshot`, stable IDs, draft/publishable checkpoints, blocks, media, embeds, rights, approvals, aliases, tombstones, and release records. Derive JSON Schema, OpenAPI, validator types, editor forms, MCP schemas, D1 persistence mappings, migration checks, and renderer types from it.

D1 stores normalized structured blocks and append-only domain revisions; it is not an untyped document dump. Existing raw asides/tables that cannot yet be represented losslessly remain sanitized locked `legacyMarkup` blocks. New raw HTML is forbidden.

## Consequences

- Storage is replaceable without changing editor, MCP, or reader semantics.
- Stable IDs and snapshot hashes remain portable across Git, D1/R2 backups, and releases.
- Contract migrations require versioned transforms, parity fixtures, and explicit approval; no direct production-table editing.

## Rollback

Keep versioned snapshots and contract migration transforms. If a new contract cannot materialize a prior release exactly, block promotion and rebuild from the prior snapshot/contract version. Revert a failed draft by abandoning its isolated change set; accepted revisions are restored as a new revision rather than overwritten.
