---
name: publish-textbook-media
description: Add or review accessible PHIL 123 textbook media through the content MCP server. Use when requesting or finalizing a media asset, resolving an approved embed, or preparing a media-bearing chapter submission.
---

# Publish textbook media

Read `references/media-workflow.md`. Inspect the chapter and its passage anchors, then create or resume a changeset.

Search for a reusable cleared asset first. For a new upload, call `create_media_review_package` with structured rights, teaching-use, and accessibility declarations. This returns a server-issued `reviewPackageId` in `pending` state; it is evidence, not approval. Use that ID with `request_media_upload`, along with the filename, supported MIME type, byte count, SHA-256, and any required transcript equivalent or video poster declaration. Then use `upload_media_base64` exactly once with the returned ticket and upload token; never print, persist, or repeat that token. Poll `get_media_job`, inspect `get_media_asset` only after processing completes, then use `place_media` in a changeset. Never send iframe, HTML, CSS, database, or raw patch content.

Audio and video require a substantive transcript/equivalent that exactly matches the persisted accessibility declaration; video also requires a reviewed poster declaration. Do not call that equivalent a timed caption track. Media processing, rights clearance, or a submitted changeset can remain pending review; report that state plainly and do not invent an approval ID or imply approval. Validate, diff, and submit. A separate human release path owns rights decisions, release approval, and publication.
