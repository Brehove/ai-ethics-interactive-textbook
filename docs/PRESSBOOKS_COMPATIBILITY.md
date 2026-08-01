# Pressbooks Compatibility Boundary

The website chapter files are structurally compatible with the established Pressbooks Markdown workflow, but compatibility is not publication readiness.

Each `chapter.md`:

- begins with exactly one Markdown H1 that supplies the chapter title;
- contains no YAML frontmatter;
- preserves intentional raw semantic HTML, including native Pressbooks textboxes and accessible tables;
- keeps the existing IDs and `aria-labelledby` relationships;
- contains no scripts, styles, forms, local-file URLs, or parent-directory links;
- carries website-only stable identity comments that must be removed from a Pressbooks preparation copy.

Create a marker-free temporary source with:

```bash
node scripts/prepare-pressbooks-source.mjs \
  --chapter content/chapters/<NN-slug>/chapter.md \
  --output <temporary-file.md>
```

The command will not overwrite the canonical chapter. It does not run the global converter, update a stewardship record, validate deployment HTML, authorize a write, or publish anything.

Run the repository compatibility gate with:

```bash
node scripts/validate-pressbooks.mjs
```

That gate checks the preparation boundary, leading title, prohibited markup and links, raw HTML IDs, callout labels, and accessible raw tables. It intentionally leaves `meta.pressbooks.validated` and `meta.pressbooks.publishAuthorized` set to `false`.

## Future Pressbooks synchronization

The website is canonical for this website. It does not silently replace the protected Pressbooks publication workspace or the chapter's operational stewardship sidecar. A future Pressbooks update must still follow the global Pressbooks workflow:

1. identify and fresh-pull the named live chapter;
2. preserve a rollback record;
3. reconcile the website change with the protected source and current live body;
4. create and approve the stewardship event, including the public change summary and contribution record;
5. generate a marker-free source and convert it with the shared converter;
6. require zero structural validator errors and resolve every warning;
7. stop for explicit authorization for the named chapter or batch;
8. push through the existing API client;
9. read back the API body and verify the rendered page at desktop and narrow widths;
10. finalize the stewardship event and regenerate and verify Version History.

The three July 31 Module 7 website baselines deliberately differ from their July 17 Pressbooks release lineage. Their metadata preserves both states and makes no claim that the newer website text has passed a Pressbooks conversion, stewardship, or publication gate.

## Print and offline export

`meta.exports` declares print, offline HTML, reading JSON, and plain-text availability. Browser print/PDF and static downloadable HTML are website exports. They do not stand in for Pressbooks EPUB/PDF verification. Any future book-wide EPUB or print-PDF adoption still needs rendered export QA for tables, callouts, figures, links, and reading order.
