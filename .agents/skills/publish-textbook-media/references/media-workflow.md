# Media workflow

Use a semantic media record, not an iframe or raw markup. Supply useful alt text, caption or omission reason, teaching use, rights evidence, and the required fallback for an external embed.

For native media:

1. Run `search_media` before uploading to avoid duplicate assets.
2. Call `create_media_review_package` with `rights`, `editorial`, `accessibility`, and a UUID `idempotencyKey`. Preserve the returned `reviewPackageId` and declaration hash. The state is pending, never implicitly cleared.
3. Call `request_media_upload` with that server-issued ID and exact byte metadata. Audio and video also carry `{provided:true, language, text}` as a transcript equivalent; the language and text must exactly match the review package. Video also carries `{provided:true, alt}` for its poster.
4. Use the one-time upload token only for `upload_media_base64`, then poll `get_media_job`. Use `get_media_asset` after processing and inspect the rights status rather than assuming clearance.
5. Use `place_media` with the immutable `mediaId`, `mediaVersionId`, and `rightsCaseId`, plus placement-specific accessibility, caption, credit, display, animation, download, and print semantics.

For provider media, call `resolve_provider_url`. Use the server-returned provider identity and adapter version, then author the required fallback before `upsert_embed`. YouTube, Vimeo, and X are click-to-load; Spotify requires explicit consent; SoundCloud and Bluesky remain link-first. Unsupported URLs become authored rich links. Never submit third-party embed HTML.

Every changeset mutation needs `changeSetId`, `baseRevisionId`, `expectedVersion`, and a UUID `idempotencyKey`. Sequence work as search → pending evidence package → upload/process or provider resolve → insert/place → validate → diff → submit → human handoff. The normal MCP token cannot clear/block rights, approve/reject a submitted snapshot, publish, promote, or roll back. Do not describe a transcript equivalent as a timed caption track.
