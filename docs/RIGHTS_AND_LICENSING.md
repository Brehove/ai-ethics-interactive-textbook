# Rights and Licensing

The repository separates four rights domains that must not be collapsed into one generic "open source" label.

## Prose: CC BY 4.0

The eighteen chapter texts and the prose payload repeated in `reading.json` and `reading.txt` are licensed under Creative Commons Attribution 4.0 International. Reuse requires attribution. Generated reading formats do not change the prose license merely because they are machine-readable.

## Original project artwork: CC BY 4.0

Original project artwork is licensed under Creative Commons Attribution 4.0 International unless an item-level record says otherwise. Site-level artwork is recorded separately from chapter reuse in [`docs/rights/site-assets.json`](rights/site-assets.json), because it is not a chapter asset and does not belong in a chapter's `rights.json` references. `node scripts/validate-rights.mjs` verifies every registered site image's path, rights fields, provenance fields, checksum, byte count, format, dimensions, and one-to-one coverage of `public/images/`.

The landing-page hero, `public/images/piranesi-oculus-hero.webp`, is original project artwork generated with AI assistance under editorial direction. Its record identifies the file, its exact checksum, a reusable attribution line, and the limited provenance statement required for public reuse. The Piranesi reference identifies an architectural visual motif; it is not a claim that a particular third-party Piranesi work was reproduced or adapted.

## Code: MIT

Application source, build scripts, and validators are covered by the MIT policy. The code license does not grant rights to the chapter prose or to third-party images, quotations, or source documents.

## Original metadata: CC0 1.0

Original structural metadata, entity records, source-link descriptions, and relationships authored for this project are dedicated under CC0 1.0. A metadata record may describe CC BY prose or a restricted third-party object; CC0 on the description does not relicense the described object.

## Third-party and adapted items

`content/rights/registry.json` is the item-level registry. Every chapter's `rights.json` names the registry records it uses, while `meta.json` separately lists genuine chapter-level license exceptions. The distinction matters:

- an adaptation record tracks reuse and attribution even when the source and resulting chapter are both CC BY 4.0;
- a license-exception record identifies an item whose terms differ from the chapter's default;
- a citation to scholarship is not automatically an adaptation or a license exception;
- an open URL is not proof that an image, edition, translation, or document is openly licensed.

The baseline has one formal adaptation record: Chapter 3 adapts in part Joel Gladd's CC BY 4.0 CWI 101 chapter, *What Generative AI Is: How LLMs Produce Fluent Answers That Still Need Checking*. The record preserves the public source, creator, publisher, license, reuse status, and visible-attribution requirement without carrying private production paths.

Before adding a primary document, portrait, diagram, or Wikimedia asset:

1. identify the exact item and edition;
2. record creator, title, public source URL, rights statement, license URL, and required credit;
3. distinguish public domain, CC0, Creative Commons, permission, fair-use analysis, and unknown status;
4. create an item-level registry record when the item is shipped or quoted beyond ordinary citation;
5. reference that record from the chapter;
6. preserve visible attribution wherever the item's terms require it.

Wikipedia API biographical facts and Wikimedia Commons media are separate rights questions. A biography assembled from factual metadata may be original CC0 metadata; a specific Wikipedia extract remains CC BY-SA, and each Commons image keeps the license shown on its file page.

Run `node scripts/validate-rights.mjs` after changing licenses, attribution, adaptations, or third-party assets.
