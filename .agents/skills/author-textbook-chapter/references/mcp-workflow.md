# Content MCP workflow

1. `list_chapters`, `get_chapter`, `list_passages`
2. `create_or_resume_changeset`
3. Use a named semantic mutation with `changeSetId`, `baseRevisionId`, and UUID `idempotencyKey`.
4. `render_preview` for a one-time immutable web/mobile/print/offline inspection, then `validate_changeset` and `diff_changeset`
5. `submit_changeset` → human release handoff. Approval, rejection, and publication are deliberately absent from the normal agent MCP.

Stop at submit. Normal agents never approve, reject, publish, promote, or roll back; the separate human release path owns every later gate.
