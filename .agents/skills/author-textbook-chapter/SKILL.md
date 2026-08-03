---
name: author-textbook-chapter
description: Draft, revise, save, or publish a PHIL 123 textbook chapter through the agent-native content MCP server. Use when adding or revising anchored prose, chapter structure, sources, or reading-record content, including an explicitly requested immediate live save.
---

# Author a chapter

Read `references/mcp-workflow.md` before mutation. List and get the chapter, then list passages and preserve their IDs.

For one chapter, create or resume a chapter-scoped changeset. For a coordinated edit spanning chapters, call `create_changeset` once with every target. On multi-chapter drafts, pass the exact `documentId`, base revision, working version, changeset ID, and a fresh UUID idempotency key for every write and preview. Use only semantic tools; do not send raw HTML, CSS, SQL, or patch payloads.

Validate and inspect the complete changeset diff. Then choose exactly one finish:

- If the user explicitly asked to save or publish the chapter immediately, confirm `textbook://capabilities` reports `maySaveLive: true`, and call `save_live_revision` with the exact current preconditions. Report the new immutable revision ID. Never infer live publication from a request to draft, propose, preview, or review.
- Otherwise, submit for review. For multi-chapter submission, bind every target's current `documentId`, `baseRevisionId`, and `expectedVersion`; if any target is stale, stop and re-read rather than retrying blindly.

Live save is limited to one D1-authoritative chapter. It creates a public canonical revision and version-history entry, but it does not approve or promote a protected whole-site release. Agents never approve, reject, change authority, promote, or roll back.
