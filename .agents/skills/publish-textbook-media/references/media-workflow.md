# Media workflow

Use a semantic media record, not an iframe or raw markup. Supply useful alt text, caption or omission reason, teaching use, rights evidence, and the required fallback for an external embed.

For native media:

1. Run `search_media` before uploading to avoid duplicate assets.
   Confirm `textbook://capabilities` identifies the expected agent/run and includes `media:upload`. Tool absence is an authorization boundary, not a discovery failure.
2. Call `create_media_review_package` with `rights`, `editorial`, `accessibility`, and a UUID `idempotencyKey`. Preserve the returned `reviewPackageId` and declaration hash. The state is pending, never implicitly cleared.
3. Run `scripts/upload-media.mjs --file <local-file> --review-package-id <id> --mime-type <type> --idempotency-key <uuid>`. For audio/video, add `--transcript-file <text-file> --language <tag>` whose text exactly matches the review package. For video, also add `--poster-alt <text>`.
4. The helper calculates bytes and SHA-256 locally, requests the ticket, and streams raw bytes without putting the file or one-time token into MCP/model context. Poll `get_media_job`. Use `get_media_asset` after processing and inspect the rights status rather than assuming clearance.
5. Use `place_media` with the immutable `mediaId`, `mediaVersionId`, and `rightsCaseId`, plus placement-specific accessibility, caption, credit, display, animation, download, and print semantics.

For provider media, call `resolve_provider_url`. Use the server-returned provider identity and adapter version, then author the required fallback before `upsert_embed`. YouTube, Vimeo, and X are click-to-load; Spotify requires explicit consent; SoundCloud and Bluesky remain link-first. Unsupported URLs become authored rich links. Never submit third-party embed HTML.

Every changeset mutation needs `changeSetId`, `baseRevisionId`, `expectedVersion`, and a UUID `idempotencyKey`. Sequence work as search → pending evidence package → upload/process or provider resolve → insert/place → validate → diff. Submit for human review by default. If the exact media evidence is cleared, the user explicitly requests immediate publication, and `textbook://capabilities` reports `maySaveLive: true`, finish with `save_live_revision` instead. The capability cannot clear/block rights, approve/reject a submitted snapshot, change authority, promote a protected whole-site release, or roll back. Do not describe a transcript equivalent as a timed caption track.
