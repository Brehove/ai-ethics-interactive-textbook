# Content MCP workflow

1. `get_authoring_view`, then `get_passage` for each passage that will change.
2. Call `create_or_resume_changeset` for the exact chapter.
3. Use a named semantic mutation with `changeSetId`, `documentId`, `baseRevisionId`, `expectedVersion`, and a UUID `idempotencyKey`. Use `replace_chapter_document` only for a deliberate whole-document replacement.
4. Call `preview_changes`; then inspect `get_version_history` and the returned mutation receipts.
5. Choose one terminal action:
   - Ordinary workflow: leave the isolated changeset and hand off its exact identity, base revision, working version, and preview.
   - Explicit immediate publication: only for one D1-authoritative chapter and only when the user's current request says to save or publish live. Read `textbook://capabilities`; require `mayCommitLive: true`, the exact chapter allowlist, and `commit_live` in the operation allowlist. Call `commit_live` with the exact preconditions. If delivery is pending, poll `get_live_commit_status` with the same chapter ID and receipt; do not create a second commit.

`commit_live` is a chapter-level Save: it creates one immutable public revision and projection, then reports verified or pending delivery. It is not whole-site release approval or promotion. Agents never approve rights, change authority, promote a protected release, or roll back. If the live-commit tool is absent, stop rather than substituting a bypass for the user's publication request.
