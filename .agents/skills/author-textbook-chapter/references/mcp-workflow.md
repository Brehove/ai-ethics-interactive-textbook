# Content MCP workflow

1. `list_chapters`, `get_chapter`, `list_passages`
2. `create_or_resume_changeset`
3. Use a named semantic mutation with `changeSetId`, `baseRevisionId`, and UUID `idempotencyKey`.
4. `validate_changeset`, then `diff_changeset`
5. `submit_changeset` → `approve_changeset` → `publish_changeset`

Stop at submit unless explicit approval authorizes the next gate. Publish and rollback are destructive, open-world operations.
