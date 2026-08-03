# Content MCP workflow

1. `list_chapters`, `get_chapter`, `list_passages`
2. For one chapter, call `create_or_resume_changeset`. For one coordinated change across chapters, call `create_changeset` with 1–18 unique targets.
3. Use a named semantic mutation with `changeSetId`, `baseRevisionId`, `expectedVersion`, and a UUID `idempotencyKey`. Add `documentId` whenever the changeset has multiple targets.
4. Call `render_preview` per target when visual confirmation matters. Then call `validate_changeset` once and `diff_changeset` without a selector to inspect every target.
5. Choose one terminal action:
   - Ordinary workflow: call `submit_changeset`. A single target may use top-level `baseRevisionId` and `expectedVersion`; multiple targets must supply the complete `documents` precondition array. Any stale target rejects the entire submission. Hand the immutable snapshot to the human release path.
   - Explicit immediate publication: only for one D1-authoritative chapter and only when the user's current request says to save or publish live. Read `textbook://capabilities`; require `maySaveLive: true`. Call `save_live_revision` with the exact `changeSetId`, `baseRevisionId`, `expectedVersion`, and a fresh UUID. Read back the chapter and confirm the returned revision is canonical.

`save_live_revision` is a chapter-level Pressbooks-style Save: it creates an immutable public revision immediately. It is not whole-site release approval or promotion. Agents never approve, reject, change authority, promote a protected release, or roll back. If the live-save tool is absent, stop rather than substituting review submission for the user's publication request.
