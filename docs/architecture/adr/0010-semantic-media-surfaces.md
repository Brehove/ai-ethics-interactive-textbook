# ADR 0010: Semantic media surfaces

Status: Accepted

Date: 2026-08-06

## Decision

Schema-v4 media figures may declare one optional semantic `surface` inside their card presentation:

- `plain` keeps the image visually unadorned and treats caption and credit as secondary figure metadata.
- `panel` renders the image, caption, and credit as one bounded contextual artifact using renderer-owned padding, background, and an accent rule.

The layout catalog exposes surfaces only for `mediaFigure` cards. The Content API rejects a surface on embeds, diagrams, artifact cards, source cards, and managed person placements. The instructor editor and textbook MCP use the same typed `cardPresentation.set` operation and catalog version; neither accepts CSS classes or style values.

The shared renderer owns panel markup and CSS for reader, editor, protected preview, print, offline, and no-JavaScript projections. The panel does not alter media identity, rights, accessibility text, framing, download policy, source order, or layout-region behavior.

## Consequences

- Authors can distinguish a conventional figure from a contextual artifact without changing component identity or adding chapter-specific CSS.
- Existing schema-v4 revisions remain immutable and render as plain figures when `surface` is absent.
- A `2026-08-05` or `2026-08-06` layout document advances to catalog `2026-08-06.1` on its next layout mutation.
- The `card_layouts_v1` runtime flag advances with the renderer version; no chapter revision is rewritten by migration.
