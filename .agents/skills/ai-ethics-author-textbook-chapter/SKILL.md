---
name: ai-ethics-author-textbook-chapter
description: Draft, revise, save, or publish a PHIL 123 textbook chapter through the agent-native content MCP server. Use when adding or revising anchored prose, chapter structure, sources, or reading-record content, including an explicitly requested immediate live save.
---

# Author a chapter

Read `references/mcp-workflow.md` before mutation. Call `get_authoring_view`, then `get_passage` for every passage you will alter. Preserve stable passage IDs and treat managed placements as typed records, never chapter HTML.

Use the `ai-ethics-textbook` MCP connection supplied by the plugin. If its tools are unavailable or Codex reports that authentication is required, stop and ask the user to authenticate or reconnect that MCP server. Never substitute direct HTTP calls, an environment bearer, repository edits, or a local content fallback for this workflow.

For one chapter, call `create_or_resume_changeset`. Pass the exact document ID, base revision, working version, changeset ID, and a fresh UUID idempotency key for every write and preview. Use `replace_passage_text` for narrow prose edits or `replace_chapter_document` for a whole-chapter import. Use only semantic tools; do not send raw HTML, CSS, SQL, or patch payloads.

Call `preview_changes`, inspect the result, then inspect `get_version_history`. Then choose exactly one finish:

- If the user explicitly asked to save or publish the chapter immediately, call `commit_live` directly with the identical changeset, chapter, base revision, expected version, and idempotency key. Do not request a second per-change approval. The trusted OAuth grant supplies `content:live-save`; if the server says trusted publishing is unavailable, stop and ask the user to reconnect the `ai-ethics-textbook` MCP once, then continue in a new task. Report the immutable revision, content hash, projection hash, URL, and whether delivery is verified or pending. For pending delivery, call `get_live_commit_status`. Never mint a new idempotency key for a retry.
- Otherwise, leave the isolated draft in place and report its changeset, document, base revision, working version, and preview evidence. The current Unified contract does not use agent submission/approval as the normal chapter-save path.

Live commit requires the trusted OAuth `content:live-save` scope plus explicit save or publish language in the user's current request. It creates a public canonical revision and version-history entry, but it does not approve rights, change authority, deploy code/schema, or promote a protected whole-site release.
