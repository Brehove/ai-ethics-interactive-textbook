# Public Content Model

The repository is the website's content source of truth. A chapter is not a database row and does not depend on a private filesystem path. Each of the eighteen chapters is a materialized directory under `content/chapters/`:

```text
content/chapters/NN-slug/
  chapter.md          CC BY 4.0 prose and semantic HTML
  meta.json           order, Part, routes, export state, release lineage
  annotations.json    passage-linked annotations keyed to stable identities
  source-links.json   primary and companion source metadata
  world.json          people, concepts, traditions, and places
  rights.json         chapter-to-rights-registry references
  reading.json        generated provider-neutral reading representation
  reading.txt         generated plain-text reading representation
```

`content/book.json` fixes the six-Part, eighteen-chapter reading order. `content/reconciliation-map.json` is the explicit, sanitized migration decision. It records only source routes relative to a source root supplied at import time; it never stores the resolved private paths behind the former symlinks.

## Canonical and generated files

Edit these canonical inputs:

- `chapter.md` for chapter prose, links, and retained semantic HTML;
- `meta.json` only for deliberate metadata changes that are not generated reading metrics;
- `annotations.json`, `source-links.json`, and `world.json` for future interactive layers;
- `rights.json` together with `content/rights/registry.json` for reused items.

Do not hand-edit `reading.json` or `reading.txt`. After changing `chapter.md`, run:

```bash
node scripts/generate-reading.mjs --chapter <slug> --write
node scripts/validate-reading.mjs
node scripts/validate-content.mjs
```

The first command preserves existing section and passage IDs, adds new IDs at new semantic block boundaries, and refreshes the description, word count, reading time, canonical hash, JSON, and plain text. A check-only run is also available:

```bash
node scripts/generate-reading.mjs --all --check
```

The importer is migration tooling, not the normal editor. Do not rerun it over repository edits. It refuses to overwrite generated targets unless a maintainer supplies `--replace`, which should be treated as a new, reviewed reconciliation event.

## Stable identity

Every section and semantic reading block has an invisible Markdown comment immediately before it:

```markdown
<!-- phil-section-id: ch02-s003 -->
## Begin with a Judgment

<!-- phil-passage-id: ch02-p0008 -->
Start by saying what you think someone should do.
```

These IDs are the durable join points for annotations, judgment prompts, deep links, future class activities, and streaming audio segments. Editors should move the marker with its section or passage. They should delete the marker when deleting that entire block. The synchronization tool allocates new IDs above the chapter's current maximum; it does not renumber surviving blocks.

Identity comments are website authoring metadata used to anchor annotations, figures, and reading-layer interactions. Preserve them through ordinary chapter revisions.

## Loading content in Astro

`src/content.config.ts` validates seven collections: chapter Markdown, chapter metadata, annotations, source links, world records, rights records, and reading records, plus the book record. Markdown rendering is deferred so the large book does not need to keep every rendered chapter in memory during content sync.

Pages should import from `src/lib/content.ts`, not assemble file paths:

```ts
getBook()
getChapterSummaries()
getChapterSlugs()
getChapter(slug)
requireChapter(slug)
getAdjacentChapters(slug)
```

`getChapter()` returns `{ meta, entry, Content, headings, annotations, sourceLinks, world, rights, reading, previous, next }`. `Content` is the rendered Astro component. `ChapterSummary` guarantees `title`, `subtitle`, `description`, `order`, `part`, `path`, `wordCount`, and `readingMinutes`.

## GitHub and admin editing

GitHub remains canonical even when a protected admin editor is added. The safe bidirectional flow is:

1. The editor fetches the current Markdown and its Git commit SHA.
2. The instructor edits the same canonical file the repository exposes.
3. The editor submits a commit or pull request through the GitHub API, using the fetched SHA as an optimistic concurrency check.
4. A conflicting repository edit stops the save and requires an explicit merge; the editor never silently overwrites newer Markdown.
5. CI regenerates or checks reading artifacts, validates content and rights, audits the public boundary, and builds the site.
6. Cloudflare deploys only after the repository change passes those gates.

That is bidirectional editing without a second content store. A local or GitHub edit appears in the admin surface after refresh; an admin edit is a normal Git commit. Draft state should remain in the browser or in a Git branch, not in a database. Student-facing reflection state is never part of this content model.

## Migration decisions

The baseline contains the eighteen chapters in the published six-Part order. It excludes the optional nineteenth companion/robot-rights draft. Two bounded transformations were applied at import:

- the Testing Moral Arguments H1 now uses the approved public title;
- the two obsolete Aristotle links in Delegating Judgment now point to the current chapter.

The three Module 7 chapters use their July 31 course-aligned drafts as website baselines. Earlier source and deployment hashes remain migration provenance only; they do not identify a second active edition.
