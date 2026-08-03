---
name: author-textbook-chapter
description: Draft or revise a PHIL 123 textbook chapter through the agent-native content MCP server. Use when adding or revising anchored prose, chapter structure, sources, or reading-record content without bypassing editorial review.
---

# Author a chapter

Read `references/mcp-workflow.md` before mutation. List and get the chapter, then list passages and preserve their IDs.

Create or resume one changeset. Supply the returned base revision, changeset ID, and a fresh UUID idempotency key for every write. Use only semantic tools; do not send raw HTML, CSS, SQL, or patch payloads.

Validate and inspect the changeset diff. Submit it for review. A separate human release path owns approval and publication.
