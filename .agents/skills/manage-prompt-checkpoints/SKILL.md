---
name: manage-prompt-checkpoints
description: Create, revise, or remove PHIL 123 reading-record prompt checkpoints through the content MCP server. Use when a chapter needs any number of checkpoints or when a checkpoint's passage anchor, internal key, prompt, strategy, guidance, or word-response design must change safely.
---

# Manage prompt checkpoints

Read `references/checkpoint-rules.md`. Read the chapter and passages first; anchor every checkpoint to an existing passage.

Chapters may contain zero, one, or many ordered checkpoints. Create or resume a changeset, then use `upsert_checkpoint` with the current base revision, changeset ID, and unique UUID idempotency key. Give every new checkpoint a unique stable lowercase key; preserve its `checkpointId` when revising it. Use `remove_checkpoint` by stable ID or internal key when removing one. Do not modify the reading record with raw markup or client-side state.

Render the immutable one-time preview and inspect both the inline placement and sidebar state. Then validate and diff the changeset. Submit for review and stop there. Normal agents never approve, reject, or publish; hand the exact submitted snapshot identity to the separate human release path.
