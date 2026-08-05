# Media workflow

Use a semantic media record, not an iframe or raw markup. Supply useful alt text, caption or omission reason, teaching use, rights evidence, and the required fallback for an external embed.

For native media:

1. Read `get_authoring_view` and preserve the target stable passage anchor. Confirm `textbook://capabilities` identifies the expected agent/run and includes `media:read` plus `media:upload`; tool absence is an authorization boundary, not a discovery failure.
2. Call `search_media` with bounded filters and reuse a cleared immutable version before proposing a duplicate upload.
3. For a new asset, call `create_media_review_package` with exact rights, editorial, and accessibility declarations plus a UUID idempotency key. Preserve its server ID and declaration hash. The package begins `pending`; it is not implicit clearance.
4. Run `scripts/upload-media.mjs --file <local-file> --review-package-id <id> --mime-type <type> --idempotency-key <uuid>`. For audio/video, add `--transcript-file <text-file> --language <tag>`; for video, add `--poster-alt <text>`.
5. The helper calculates bytes and SHA-256 locally, calls the same bounded upload-ticket route exposed as `upload_media`, and streams raw bytes without putting the file or one-time token into MCP/model context. Poll `get_media_job`, then inspect `get_media_asset`; never infer processing or clearance from ticket creation.
6. Use `place_media` with the immutable `mediaId`, `mediaVersionId`, and `rightsCaseId`, plus placement-specific accessibility, caption, credit, display, animation, download, and print semantics.

For provider media, call `resolve_provider_url`. Use the server-returned provider identity and adapter version, then author the required fallback before `upsert_embed`. YouTube, Vimeo, and X are click-to-load; Spotify requires explicit consent; SoundCloud and Bluesky remain link-first. Unsupported public HTTPS URLs become authored rich links. Never submit third-party embed HTML.

Every changeset mutation needs `changeSetId`, `documentId`, `baseRevisionId`, `expectedVersion`, and a UUID `idempotencyKey`. Sequence work as authoring view → upload/process or provider resolution → place → preview. If the exact media evidence is cleared, the user explicitly requests immediate publication, and `textbook://capabilities` reports `mayCommitLive: true` for the exact chapter/operation, finish with `commit_live` and poll its receipt if pending. The capability cannot clear/block rights, approve/reject evidence, change authority, promote a protected whole-site release, or roll back. Do not describe a transcript equivalent as a timed caption track.
