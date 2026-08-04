---
name: publish-textbook-media
description: Add or review accessible PHIL 123 textbook media through the content MCP server. Use when requesting or finalizing a media asset, resolving an approved embed, or preparing a media-bearing chapter submission.
---

# Publish textbook media

Read `references/media-workflow.md`. Inspect `get_authoring_view` and its passage anchors, then create or resume a changeset.

Search for a reusable cleared asset first. For a new upload, call `upload_media` only with bounded metadata; it returns a raw upload ticket. Then run `scripts/upload-media.mjs` with the approved local file, ticket data, MIME type, and a UUID idempotency key. Add `--transcript-file` and `--language` for audio/video, and `--poster-alt` for video. The helper computes byte count and SHA-256 locally and streams the file through the raw authenticated upload lane. Local paths, file bytes, and one-time upload tokens never enter model context. Poll media status after processing completes, then use `place_media` in the changeset. Use `upsert_embed` only with a typed allowlisted provider and authored fallback. Never send iframe, HTML, CSS, database, or raw patch content.

`TEXTBOOK_MCP_ACCESS_TOKEN` must contain a short-lived bearer issued by the instructor-approved device flow for this exact agent/run, chapter, and allowed operations; it is not a shared static secret. The MCP capability receipt exposes the authenticated actor, run, expiry, scope, chapter allowlist, operation allowlist, and hard prohibitions. If the media tools are absent, stop: the server intentionally hides tools outside the token's claims.

Audio and video require a substantive transcript/equivalent that exactly matches the persisted accessibility declaration; video also requires a reviewed poster declaration. Do not call that equivalent a timed caption track. Media processing and rights clearance can remain pending; report that state plainly and do not invent an approval ID or imply clearance.

Call `preview_changes` after placement. If every pinned media version is cleared, the user explicitly asked to save or publish now, and `textbook://capabilities` reports `mayCommitLive: true` for the exact chapter, call `commit_live` and report its delivery state. Otherwise leave the isolated draft. The capability cannot clear rights, change authority, deploy code/schema, promote a protected release, or roll back.
