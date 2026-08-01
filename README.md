# AI Ethics Interactive Textbook

A public, static, Git-backed interactive edition of the PHIL 123 AI and Ethics textbook.

The reader treats philosophical interaction as disciplined reading rather than gamification. Every chapter has four route-backed layers:

- **First Read:** the complete canonical chapter.
- **Deep Read:** the same prose with argument, objection, and judgment scaffolding.
- **Sources:** primary texts, editions, evidence, and rights records.
- **World:** people, concepts, traditions, places, and intellectual lineages.

All required reading works without JavaScript. Each chapter also has print CSS, a browser-native **Print / Save as PDF** action, a self-contained HTML download, and provider-neutral JSON/plain-text reading representations for a possible future streaming voice layer.

## Local development

Use Node 22 (pinned in `.nvmrc`).

```bash
npm ci
npm run validate
npm run build
npm run dev
```

The production build is written to `dist/`. It contains no server-rendered student routes, database, analytics, or student account system.

## Canonical content

The 18 canonical chapter files are:

```text
content/chapters/<NN>-<slug>/chapter.md
```

The same Git history is used by local editing and the instructor-only browser editor. The browser editor uses a repository-scoped GitHub App, preserves raw source, creates a branch and pull request, and cannot write or merge `main`.

Read:

- [`docs/CONTENT_MODEL.md`](docs/CONTENT_MODEL.md)
- [`docs/AUTHORING.md`](docs/AUTHORING.md)
- [`workers/editor-auth/README.md`](workers/editor-auth/README.md)
- [`docs/PRESSBOOKS_COMPATIBILITY.md`](docs/PRESSBOOKS_COMPATIBILITY.md)
- [`docs/VOICE_BOUNDARY.md`](docs/VOICE_BOUNDARY.md)

## Content maintenance

The migration importer is intentionally not a routine authoring command. It requires an explicit external source root and the reviewed reconciliation map. After canonical cutover, edit the repository files directly.

When chapter prose changes:

```bash
npm run content:generate
npm run validate
npm run build
```

CI rejects symlinks, private machine paths, credential-shaped values, missing content relationships, stale reading derivatives, and incompatible Pressbooks preparation.

## Publication boundaries

- GitHub is the canonical source and review history.
- Cloudflare Workers Static Assets serves the public Astro build.
- Pressbooks remains an independent downstream OER edition and fallback.
- A Git merge or Cloudflare deployment never publishes to Pressbooks.
- Canvas remains the durable course discussion, submission, identity, and grading layer.

## Privacy

The public reader creates no student account and does not persist student judgments or reflection text. It ships no student analytics beacon. GitHub and Cloudflare necessarily retain normal authoring, build, security, and request metadata; Canvas retains work students intentionally submit there. See [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Licenses

This is a multi-license repository:

- original textbook prose: [CC BY 4.0](LICENSES/CC-BY-4.0.txt);
- software: [MIT](LICENSES/MIT.txt);
- original structured metadata: [CC0 1.0](LICENSES/CC0-1.0.txt);
- third-party texts, translations, and media: item-level terms in the rights registry.

See [`LICENSE`](LICENSE) and [`docs/RIGHTS_AND_LICENSING.md`](docs/RIGHTS_AND_LICENSING.md). A repository-level license never relicenses third-party material.
