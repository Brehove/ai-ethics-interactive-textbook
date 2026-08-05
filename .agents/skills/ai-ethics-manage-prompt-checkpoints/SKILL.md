---
name: ai-ethics-manage-prompt-checkpoints
description: Create, revise, or remove PHIL 123 reading-record prompt checkpoints through the content MCP server. Use when a chapter needs any number of checkpoints or when a checkpoint's passage anchor, internal key, prompt, strategy, guidance, or word-response design must change safely.
---

# Manage prompt checkpoints

Read `references/checkpoint-rules.md`. Call `get_authoring_view` and read each target passage first; anchor every checkpoint to an existing passage.

Chapters may contain zero, one, or many ordered checkpoints, including repeated stages and multiple checkpoints at one passage. Create or resume a changeset, then use `upsert_checkpoint` with the current base revision, changeset ID, display order, and unique UUID idempotency key. Preserve `checkpointId` when revising it. Use `reorder_checkpoint` to change only order and `remove_checkpoint` by stable ID when removing one. Do not modify the reading record with raw markup or client-side state.

Call `preview_changes` and inspect both inline placement and sidebar state. If the user explicitly asked to save or publish now and `textbook://capabilities` reports `mayCommitLive: true` for this exact chapter, call `commit_live`; report the delivery state and poll `get_live_commit_status` if it is pending. Otherwise leave the isolated draft and hand off its exact changeset identity. Never infer immediate publication from a request to draft or preview, and never approve rights, change authority, deploy code, or roll back.
