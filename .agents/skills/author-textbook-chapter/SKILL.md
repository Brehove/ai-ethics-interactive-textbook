---
name: author-textbook-chapter
description: Draft or revise a PHIL 123 textbook chapter through the agent-native content MCP server. Use when adding or revising anchored prose, chapter structure, sources, or reading-record content without bypassing editorial review.
---

# Author a chapter

Read `references/mcp-workflow.md` before mutation. List and get the chapter, then list passages and preserve their IDs.

For one chapter, create or resume a chapter-scoped changeset. For a coordinated edit spanning chapters, call `create_changeset` once with every target. On multi-chapter drafts, pass the exact `documentId`, base revision, working version, changeset ID, and a fresh UUID idempotency key for every write and preview. Use only semantic tools; do not send raw HTML, CSS, SQL, or patch payloads.

Validate and inspect the complete changeset diff. For multi-chapter submission, bind every target's current `documentId`, `baseRevisionId`, and `expectedVersion`; if any target is stale, stop and re-read rather than retrying blindly. Submit for review. A separate human release path owns approval and publication.
