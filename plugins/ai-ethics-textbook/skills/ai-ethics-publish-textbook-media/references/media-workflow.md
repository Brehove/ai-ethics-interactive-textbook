# Media workflow

Use a semantic media record, not an iframe or raw markup. Supply useful alt text, caption or omission reason, teaching use, rights evidence, and the required fallback for an external embed.

For native media:

1. Read `get_authoring_view` and preserve the target stable passage anchor. Use only the plugin-provided MCP connection; tool absence or an authentication prompt requires MCP authentication, never a direct-API or environment-token fallback.
2. Call `search_media` with bounded filters and reuse a cleared immutable version before proposing a duplicate upload.
3. For a new asset, call `create_media_review_package` with exact rights, editorial, and accessibility declarations plus a UUID idempotency key. Preserve its server ID and declaration hash. The package begins `pending`; it is not implicit clearance.
4. Run `scripts/upload-media.mjs --inspect --file <local-file> --mime-type <type>`. Use its exact filename, byte count, and SHA-256 in `upload_media`, together with the persisted review package, a UUID idempotency key, and any required transcript-equivalent/poster declaration.
5. Run `scripts/upload-media.mjs --file <local-file> --mime-type <type> --upload-url <ticket-url> --upload-token <one-time-token>`. The local path and bytes remain local. The token is exposed only as a short-lived, single-use capability already bound to actor, MIME type, byte count, and SHA-256; never store or reuse it. Poll `get_media_job`, then inspect `get_media_asset`; never infer processing or clearance from ticket creation.
6. Use `place_media` with the immutable `mediaId`, `mediaVersionId`, and `rightsCaseId`, an exact flow position, plus placement-specific accessibility, caption, credit, semantic `presentation`, animation, download, and print behavior. Read the live layout catalog first; never supply CSS-like dimensions.

For provider media, call `resolve_provider_url`. Use the server-returned provider identity and adapter version, then author the required fallback before `upsert_embed`. YouTube, Vimeo, and X are click-to-load; Spotify requires explicit consent; SoundCloud and Bluesky remain link-first. Unsupported public HTTPS URLs become authored rich links. Never submit third-party embed HTML.

Every changeset mutation needs `changeSetId`, `documentId`, `baseRevisionId`, `expectedVersion`, and a UUID `idempotencyKey`. Sequence work as authoring view → upload/process or provider resolution → place → preview. If the exact media evidence is cleared and the user explicitly requests immediate publication, call `commit_live` directly with unchanged preconditions; do not request a second per-change approval. Ask for a one-time MCP reconnect if the trusted grant is unavailable, and poll the commit receipt if delivery is pending. The capability cannot clear/block rights, approve/reject evidence, change authority, promote a protected whole-site release, or roll back. Do not describe a transcript equivalent as a timed caption track.
