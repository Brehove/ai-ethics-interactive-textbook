---
name: ai-ethics-publish-textbook-media
description: Add or review accessible PHIL 123 textbook media through the content MCP server. Use when requesting or finalizing a media asset, resolving an approved embed, or preparing a media-bearing chapter submission.
---

# Publish textbook media

Read `references/media-workflow.md`. Inspect `get_authoring_view` and its passage anchors, then create or resume a changeset.

Use the plugin-provided `ai-ethics-textbook` MCP connection. If its tools are absent or authentication is required, ask the user to authenticate or reconnect it. Never replace MCP with direct API calls, a standing environment bearer, repository edits, or a local content fallback.

Call `search_media` first and reuse a cleared asset when it already exists. For a new upload, call `create_media_review_package` with exact rights, teaching-use, and accessibility declarations. Its `pending` result is evidence, not approval. Run `scripts/upload-media.mjs --inspect --file <local-file> --mime-type <type>` to calculate the filename, byte count, and SHA-256 locally. Pass that exact metadata, the review-package ID, a UUID idempotency key, and any required transcript-equivalent/poster declaration to `upload_media`. Then run `scripts/upload-media.mjs --file <local-file> --mime-type <type> --upload-url <ticket-url> --upload-token <one-time-token>`. The token is short-lived, hash- and size-bound, and single-use; it is not stored as configuration or an environment secret. Poll `get_media_job`, inspect `get_media_asset`, and use `place_media` only after the exact processed version and rights state are known. For external media, call `resolve_provider_url` before `upsert_embed`; never send iframe, HTML, CSS, database, or raw patch content.

Audio and video require a substantive transcript/equivalent that exactly matches the persisted accessibility declaration; video also requires a reviewed poster declaration. Do not call that equivalent a timed caption track. Media processing and rights clearance can remain pending; report that state plainly and do not invent an approval ID or imply clearance.

Call `preview_changes` after placement. If every pinned media version is cleared and the user explicitly asked to save or publish now, call `commit_live` directly with identical preconditions; do not request a second per-change approval. If trusted publishing is unavailable, ask the user to reconnect the MCP once. Report its delivery state. Otherwise leave the isolated draft. The capability cannot clear rights, change authority, deploy code/schema, promote a protected release, or roll back.
