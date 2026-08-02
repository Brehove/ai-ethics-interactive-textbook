# Wikimedia people and portrait layer

The people layer is a static, build-time enrichment system. Students never call
Wikidata or Wikimedia Commons from the reader, and the reader does not store
student data. Curated biographies and teaching guidance remain human-authored;
the refresh command owns only factual source metadata and vendored image bytes.

## Authority boundary

| Owner | Path | Contents |
| --- | --- | --- |
| Instructor/editor | `content/entities/people/records/<id>.json` | Display name, biography, teaching rationale, course relationships, reviewed links, portrait selection |
| Instructor/editor | `content/media/records/<portrait-id>.json` | Title, alt text, caption, teaching use, and explicit rights review |
| Curated manifest | `content/entities/people/wikimedia-manifest.json` | Stable local IDs, Wikidata QIDs, exact Commons file titles, download paths, requested widths |
| Refresh tool | `content/entities/people/wikimedia/<id>.json` | Normalized Wikidata facts plus source revision, checksum, and CC0 notice |
| Refresh tool | `content/media/wikimedia/<portrait-id>.json` | Commons file metadata, item-specific rights fields, source revision/checksum, and derivative checksum |
| Refresh tool | `public/media/wikimedia/<file>` | Vendored portrait bytes served by the static site |

`npm run wikimedia:refresh` never reads a generated biography from Wikimedia and
never writes either human-owned `records/` directory. In particular, it cannot
replace `biography`, `teaching`, `alt`, `caption`, `teachingUse`, or
`rightsReview`.

The runtime join in `src/lib/content.ts` returns a `PersonBundle`:

```text
curated Person
+ slug and stable /people/<id>/ path
+ normalized Wikidata record
+ curated portrait text joined to generated Commons provenance and local asset path
```

The local vendored path is the display path. Remote `sourceUrl` and `original.url`
exist for provenance only; components must not hotlink them.

## Refresh and review workflow

Use Node 22 and run the refresh from a clean branch:

```bash
npm ci
npm run wikimedia:refresh
npm run wikimedia:validate
npm run test:wikimedia
npm run check
git diff -- content/entities/people/wikimedia content/media/wikimedia public/media/wikimedia
```

The refresh client:

- sends the identifying `PHIL123InteractiveTextbook` User-Agent and API
  User-Agent on every request;
- sends MediaWiki's `maxlag=5` parameter;
- batches Wikidata entity and label requests up to the API's 50-ID limit;
- permits at most three concurrent Commons jobs;
- honors `Retry-After` for throttling and transient 502/503/504 responses;
- retries MediaWiki `maxlag` and `ratelimited` errors with bounded backoff;
- refuses portrait downloads outside HTTPS `upload.wikimedia.org`;
- uses pinned Sharp/libvips settings to auto-orient, strip metadata, resize to at
  most 720 pixels wide, and encode WebP at quality 82;
- reduces the target width deterministically when necessary and refuses any
  portrait that remains above 250 KB;
- canonicalizes object-key order and array order so unchanged source material
  produces byte-identical JSON;
- records source revision IDs and SHA-256 checksums, and records a second SHA-256
  checksum for the exact vendored image bytes.

After a refresh changes a Commons source revision, a human must re-open that
file's Commons description page and review the creator, credit, license, usage
terms, and chosen file. Then update the curated media record:

```json
{
  "rightsReview": {
    "status": "approved",
    "reviewedAt": "2026-08-01",
    "sourceRevisionId": 123456789,
    "notes": "What was checked and any attribution decision."
  }
}
```

The offline validator fails if an approved `sourceRevisionId` does not equal the
generated Commons revision. This forces a new human review after source metadata
changes. A `pending` or `rejected` portrait cannot pass the production validator.
Wikidata facts are CC0 structured data; each Commons file still has its own
license and attribution terms. The repository's general license does not
relicense the portrait.

## Freshness check versus production validation

```bash
npm run wikimedia:check
npm run wikimedia:validate
```

`wikimedia:check` makes read-only network requests and compares live normalized
Wikimedia results with committed generated files. It repeats the local Sharp
transformation and exits nonzero when a source revision, normalized fact, rights
field, or portrait byte sequence would change.
Run it during deliberate content maintenance or in a separately monitored
scheduled workflow. Do not make every Cloudflare production build depend on
Wikimedia availability.

`wikimedia:validate` is fully offline and belongs in every build. It checks the
manifest/record one-to-one relationships, stable generated JSON, authority
separation, revision and license metadata, approved human rights review, local
asset declarations, WebP format, 720-pixel/250-KB media budgets, byte counts,
and checksums. `npm run validate:content` includes it.

Refresh does not automatically delete stale generated files or assets. This is
intentional: deletion should remain visible in review. `wikimedia:check` flags
unmanifested generated JSON, and `wikimedia:validate` flags unmanifested public
assets. Remove a confirmed stale file in the same reviewed change.

## Adding a person

1. Choose a stable lowercase local person ID. It becomes the URL slug and must
   not change when an external title changes.
2. Verify the Wikidata QID and the exact Commons `File:` title in the browser.
3. Add one manifest entry. Choose a deterministic local download path under
   `media/wikimedia/`; do not use a remote URL as the path.
4. Add the human person record and, when a portrait is used, its human media
   record with `rightsReview.status` initially set to `pending`.
5. Run `npm run wikimedia:refresh`.
6. Review the generated diff and the live Commons file page. Record the exact
   generated source revision in the approved human review.
7. Add chapter relations using the validated shape
   `{ "id", "role", "featured", "passageIds" }` in each `world.json` file.
8. Run `npm run validate`, `npm run build`, and inspect the person page and the
   canonical chapter route at narrow and wide viewports. Inspect a direct
   reference route only when the change affects it.

Chapter person resolution is fail-fast: a world relation that names an unknown
person prevents the build instead of silently dropping the card.

## Inline chapter figures

The canonical chapter route renders every relation marked `"featured": true` as
an inline scholarly figure. The retained deep-reference route uses the same
figure treatment. The enhancement locates the first durable `/people/<id>/`
link in the chapter prose and places the figure directly after that introductory
paragraph. The figure includes the vendored portrait, the chapter-specific role,
the curated teaching rationale, native biography and primary-text disclosures, a
permanent record link, and complete image credit.

This keeps placement under editorial control without inserting generated HTML
into the canonical Markdown. To move a figure, move the first durable person
link to the paragraph where the visual intervention belongs. To keep a person
available through a passage link without an inline figure, set `"featured":
false`. If JavaScript is unavailable, the same figures remain visible as an
accessible end-of-chapter gallery. No disclosure state is stored.

The primary chapter route has no manual people-and-sources launcher. Context
begins dormant and opens only from a durable passage link or an authored prompt,
so it contributes when the reading invokes it rather than competing with the
chapter. The direct Sources and World reference routes remain available without
displacing the canonical chapter as the primary reading experience.

## Failure modes

- **429, maxlag, or transient gateway errors:** the client obeys `Retry-After`
  and retries up to four attempts. If Wikimedia remains unavailable, no file is
  partially replaced; run the refresh later.
- **Partial refresh:** all network normalization completes before writes begin,
  and each changed file is written by same-directory atomic rename. A process
  interruption can leave a reviewed diff, but cannot alter human-authored files.
- **Commons title changed or deleted:** refresh fails before writing the media
  record or asset. Verify the file history and update the manifest explicitly.
- **Rights metadata missing:** refresh fails; it does not guess a license or
  creator.
- **Source revision changed:** the generated record updates, then offline
  validation fails until the new revision receives human review.
- **Vendored asset modified:** offline validation fails its byte count or SHA-256
  check.
- **Unexpected remote host:** the download is refused.

## Primary implementation references

- [MediaWiki API etiquette](https://www.mediawiki.org/wiki/API:Etiquette/en)
- [Wikimedia API rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits)
- [MediaWiki Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo)
- [Presenting Wikidata knowledge](https://www.mediawiki.org/wiki/API:Presenting_Wikidata_knowledge)
- [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)
- [Reusing Wikimedia Commons content](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/en)
