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

The `/admin/` route is the structured Textbook Editor. Git remains code authority; the Content API and D1/R2 become routine content authority one chapter at a time. During the canary, all 18 chapters can be selected and inspected, but only Chapter 7 is writable. The server rejects draft creation for every other repository-authoritative chapter. A later chapter becomes writable only after its explicit D1 authority cutover.

The editor signs the instructor in through the separate auth gateway, then reads and mutates typed chapter blocks through semantic operations. It never accepts raw HTML, CSS, SQL, iframe code, or arbitrary patches. Each write carries the canonical base revision, working-document version, and idempotency key. A stale base or working version fails with `409`; there is no last-write-wins path.

The browser supports structured prose, Commit–Work–Reconcile checkpoint prompts (including side-panel visibility), provider-registry embeds, native media review/upload/placement, validation, semantic review, submission, and exact-snapshot human approve/reject. Approval does not publish. Direct Content API publication is deliberately disabled until deployment attestations, receipts, and expected-active compare-and-swap are persisted; production promotion runs only through the protected immutable GitHub/Cloudflare release workflow.

The Preview button writes an immutable draft snapshot, issues a five-minute one-time token, and opens the separate preview origin. The preview has no authoring cookie or mutation credential, is uncached and noindexed, and verifies the stored bytes against the token-bound SHA-256 before rendering.

## Reading record prompts

Before creating or revising student reflection checkpoints, read [`READING_RECORD_PROMPT_DESIGN.md`](./READING_RECORD_PROMPT_DESIGN.md). It is the controlling guide for the three-checkpoint sequence, research-informed strategy repertoire, passage anchoring, prompt planning record, and quality gate.

Do not add a prompt merely because a passage seems important. Each checkpoint must ask students to perform an identifiable philosophical reasoning operation at the point where the chapter has made that operation possible.

## Review

Use the server semantic diff, protected one-time draft preview, and exact submitted snapshot identity as the editorial review surfaces. Reject unexplained changes to stable IDs, passage anchors, rights records, accessibility declarations, or output projections. Promotion occurs only after the signed candidate and protected deployment checks pass.

## Conflicts

If another accepted revision changes a chapter after a browser or agent changeset opened, the later mutation receives `409 REVISION_CONFLICT`. Preserve the proposed operations, reload the new canonical head, and rebase them through a new changeset. Git content editing remains frozen for a D1-authoritative chapter; do not create a competing Git edit path.
