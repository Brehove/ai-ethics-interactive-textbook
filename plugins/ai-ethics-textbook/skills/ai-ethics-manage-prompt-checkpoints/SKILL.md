---
name: ai-ethics-manage-prompt-checkpoints
description: Create, revise, move, or remove PHIL 123 reading-record prompt checkpoints through the content MCP server. Use when a chapter needs any number of checkpoints or when a checkpoint's contextual passage, explicit flow position, internal key, prompt, strategy, guidance, or word-response design must change safely.
---

# Manage prompt checkpoints

Read `references/checkpoint-rules.md`. Call `get_authoring_view` and read each target passage first. Distinguish the passage that supplies intellectual context from the checkpoint reference's exact position in chapter flow.

Use the plugin-provided `ai-ethics-textbook` MCP connection. If its tools are absent or authentication is required, ask the user to authenticate or reconnect it. Do not fall back to direct API calls, environment bearer tokens, repository edits, or local chapter files.

Chapters may contain zero, one, or many ordered checkpoints, including repeated stages and multiple checkpoints with the same contextual passage. Create or resume a changeset, then use `upsert_checkpoint` with the current base revision, changeset ID, contextual `passageId`, explicit `{ beforeNodeId }` or `{ afterNodeId }` flow position when creating, and a unique UUID idempotency key. Preserve `checkpointId` and the existing reference when revising prompt content. Use `move_checkpoint` to move the reference; use `reorder_checkpoint` only as its temporary compatibility alias. Never simulate placement by changing `passageId` or sending schema-v2 `displayOrder`. Use `remove_checkpoint` by stable ID when removing one. Do not modify the reading record with raw markup, whole-document JSON replacement, or client-side state.

Call `preview_changes` and inspect both inline placement and sidebar state. If the user explicitly asked to save or publish now, call `commit_live` directly with the exact commit preconditions; do not request a second per-change approval. If trusted publishing is unavailable, ask the user to reconnect the MCP once. Report the delivery state and poll `get_live_commit_status` if it is pending. Otherwise leave the isolated draft and hand off its exact changeset identity. Never infer immediate publication from a request to draft or preview, and never approve rights, change authority, deploy code, or roll back.
