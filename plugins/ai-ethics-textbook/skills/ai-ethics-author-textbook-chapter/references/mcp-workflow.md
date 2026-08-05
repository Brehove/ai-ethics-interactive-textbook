# Content MCP workflow

Use only the plugin-provided `ai-ethics-textbook` MCP connection. Missing tools or an authentication prompt means the MCP must be connected or reauthenticated; it never authorizes a direct API, environment-token, repository, or local-source fallback.

1. `get_authoring_view`, then `get_passage` for each passage that will change.
2. Call `create_or_resume_changeset` for the exact chapter.
3. Use a named semantic mutation with `changeSetId`, `documentId`, `baseRevisionId`, `expectedVersion`, and a UUID `idempotencyKey`. Use `replace_chapter_document` only for a deliberate whole-document replacement.
4. Call `preview_changes`; then inspect `get_version_history` and the returned mutation receipts.
5. Choose one terminal action:
   - Ordinary workflow: leave the isolated changeset and hand off its exact identity, base revision, working version, and preview.
   - Explicit immediate publication: only for one D1-authoritative chapter and only when the user's current request says to save or publish live. Call `request_live_save_authorization` with the exact changeset, chapter, base revision, expected version, and idempotency key. Show the returned verification URL and code. After approval, call `commit_live` with the returned request ID and those identical preconditions. If authorization is pending, wait for the user; if delivery is pending, poll `get_live_commit_status` with the same chapter ID and receipt. Do not create a second commit.

`commit_live` is a chapter-level Save: it creates one immutable public revision and projection, then reports verified or pending delivery. It is not whole-site release approval or promotion. Agents never approve rights, change authority, promote a protected release, or roll back. If either Live Save tool is absent, stop rather than substituting a bypass for the user's publication request.
