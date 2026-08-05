# Authoring

## Local Markdown

Edit a chapter at `content/chapters/<NN>-<slug>/chapter.md`. Keep its leading H1. Do not add YAML frontmatter; chapter identity and publication metadata live in the reviewed sidecars.

After a prose change:

```bash
npm run content:generate
npm run validate
npm run build
git switch -c content/<short-description>
git add content
git commit -m "Revise <chapter>"
git push -u origin HEAD
gh pr create --fill
```

Do not edit generated `reading.json` or `reading.txt` independently. Regenerate them from `chapter.md`.

## Browser editor

The public reader offers an instructor-only **Edit chapter** action that deep-links to the dedicated editor origin and preserves the reader URL and passage anchor for return. `/admin/` remains a compatibility entry point during rollout. Git remains code authority; the Content API and D1/R2 become routine content authority one chapter at a time. The server permits writes only after an explicit D1 authority cutover for that chapter.

The editor signs the instructor in through the separate auth gateway, then reads and mutates typed chapter blocks through semantic operations. It never accepts raw HTML, CSS, SQL, iframe code, or arbitrary patches. Each write carries the canonical base revision, working-document version, and idempotency key. A stale base or working version fails with `409`; there is no last-write-wins path.

The browser presents each chapter as one continuous, reader-identical document. In content schema v3, that ordered document is the sole authority for inline checkpoint and scholar-card placement. Checkpoint records retain a contextual `passageId` for deep links and excerpt-drift detection, but moving prose or a checkpoint changes an explicit `checkpointRef` or `placementRef` in chapter flow; it does not rewrite an anchor to simulate layout. The temporary schema-v2 adapter remains read-only compatibility behavior.

The editor supports an arbitrary number of checkpoint prompts (including side-panel visibility), provider-registry embeds, native media review/upload/placement, frozen scholar-card projections, inline validation, semantic review, and version history. Splitting a prose block retains the original identity on the left fragment and creates fresh identities on the right. **Save** validates stable IDs and references locally, preserves the active editor instance and undo history, stores a session-scoped recovery copy, and calls the guarded `commitLive` transaction once. A failed Save shows the server's content-free error message and path without remounting or moving the document. A successful Save clears the exact original recovery key only after public delivery verification.

**More → Export recovery copy** downloads the current recovery payload under the instructor's control. It includes the canonical chapter and exact visual editor document needed for restoration, but it is never transmitted to student-facing storage.

The Preview button writes an immutable draft snapshot, issues a five-minute one-time token, and opens the separate preview origin. The preview has no authoring cookie or mutation credential, is uncached and noindexed, and verifies the stored bytes against the token-bound SHA-256 before rendering.

## Reading record prompts

Before creating or revising student reflection checkpoints, read [`READING_RECORD_PROMPT_DESIGN.md`](./READING_RECORD_PROMPT_DESIGN.md). It is the controlling guide for the recommended Commit–Work–Reconcile pattern, flexible checkpoint count, research-informed strategy repertoire, contextual passage selection, visible flow placement, prompt planning record, and quality gate.

Do not add a prompt merely because a passage seems important. Each checkpoint must ask students to perform an identifiable philosophical reasoning operation at the point where the chapter has made that operation possible.

## Review

Use version history, the server semantic diff, and the reader-identical canvas as the routine editorial review surfaces. Save rejects duplicate stable IDs, unresolved references, unexplained contextual-anchor changes, rights-record changes, invalid accessibility declarations, or invalid output projections inline. Code deployments and non-content infrastructure promotion still use signed candidates and protected deployment checks; routine D1-authoritative chapter edits do not.

## Conflicts

If another accepted revision changes a chapter after a browser or agent changeset opened, the later mutation receives `409 REVISION_CONFLICT`. Preserve the proposed operations, reload the new canonical head, and rebase them through a new changeset. Git content editing remains frozen for a D1-authoritative chapter; do not create a competing Git edit path.
