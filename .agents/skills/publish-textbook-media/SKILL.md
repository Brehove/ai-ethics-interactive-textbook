---
name: publish-textbook-media
description: Add or review accessible PHIL 123 textbook media through the content MCP server. Use when requesting or finalizing a media asset, resolving an approved embed, or preparing a media-bearing chapter submission.
---

# Publish textbook media

Read `references/media-workflow.md`. Inspect the chapter and its passage anchors, then create or resume a changeset.

Search for a reusable cleared asset first. For a new upload, call `create_media_review_package` with structured rights, teaching-use, and accessibility declarations. This returns a server-issued `reviewPackageId` in `pending` state; it is evidence, not approval. Then run `scripts/upload-media.mjs` with the approved local file, review-package ID, MIME type, and a UUID idempotency key. Add `--transcript-file` and `--language` for audio/video, and `--poster-alt` for video. The helper computes byte count and SHA-256 locally, reserves a ticket, and streams the file through the raw authenticated upload lane. Local paths, file bytes, and the one-time upload token never enter model context. Poll `get_media_job`, inspect `get_media_asset` only after processing completes, then use `place_media` in a changeset. Never send iframe, HTML, CSS, database, or raw patch content.

`TEXTBOOK_MCP_ACCESS_TOKEN` must contain a short-lived capability issued for this exact agent/run with `media:upload`; it is not a shared static secret. The MCP capability receipt exposes the authenticated actor, run, expiry, scopes, and hard prohibitions. If the media tools are absent, stop: the server intentionally hides tools outside the token's scopes.

Audio and video require a substantive transcript/equivalent that exactly matches the persisted accessibility declaration; video also requires a reviewed poster declaration. Do not call that equivalent a timed caption track. Media processing and rights clearance can remain pending; report that state plainly and do not invent an approval ID or imply clearance.

Validate and diff after placement. If every pinned media version is cleared, the user explicitly asked to save or publish now, and `textbook://capabilities` reports `maySaveLive: true`, call `save_live_revision` and report the new immutable chapter revision. Otherwise submit for review. The live-save capability cannot clear rights, approve or reject evidence, change authority, promote a protected whole-site release, or roll back.
