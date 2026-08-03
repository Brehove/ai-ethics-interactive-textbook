# Content MCP workflow

1. `list_chapters`, `get_chapter`, `list_passages`
2. For one chapter, call `create_or_resume_changeset`. For one coordinated change across chapters, call `create_changeset` with 1–18 unique targets.
3. Use a named semantic mutation with `changeSetId`, `baseRevisionId`, `expectedVersion`, and a UUID `idempotencyKey`. Add `documentId` whenever the changeset has multiple targets.
4. Call `render_preview` per target. Then call `validate_changeset` once and `diff_changeset` without a selector to inspect every target.
5. Call `submit_changeset`. A single target may use top-level `baseRevisionId` and `expectedVersion`; multiple targets must supply the complete `documents` precondition array. Any stale target rejects the entire submission.
6. Hand the immutable snapshot to the human release path. Approval, rejection, and publication are deliberately absent from the normal agent MCP.

Stop at submit. Normal agents never approve, reject, publish, promote, or roll back; the separate human release path owns every later gate.
