# Public Repository Boundary

Everything committed to this repository must be safe to clone, fork, build, and inspect publicly.

Allowed:

- materialized chapter Markdown and public URLs;
- sanitized prior-release hashes and dates;
- public-facing rights and adaptation records;
- relative migration source keys that reveal no workstation location;
- empty scaffolds for later annotations, sources, entities, and world records.

Not allowed:

- symlinks into a private course or project workspace;
- local filesystem paths or local-file URLs;
- credentials, tokens, private keys, or copied environment files;
- retired-platform rollback bodies, authenticated API responses, private review packets, or internal comments;
- operational stewardship and provenance sidecars containing private paths, runtime details, or unpublished contribution records;
- the excluded optional nineteenth draft unless a later, explicit book decision adds it.

The public reconciliation map requires the source root as a command argument, verifies each selected source hash, applies only transformations with exact expected occurrence counts, and writes ordinary files. It retains only the migration lineage needed to explain how the website baseline was selected, without copying protected production sidecars.

Run the boundary audit before publishing or deploying:

```bash
node scripts/audit-public-boundary.mjs
```

The audit walks the repository outside build and dependency caches, rejects symlinks and private production sidecars, and scans text for workstation paths and probable secret material. It deliberately distinguishes source code that recognizes key formats from an actual multiline private-key payload.
