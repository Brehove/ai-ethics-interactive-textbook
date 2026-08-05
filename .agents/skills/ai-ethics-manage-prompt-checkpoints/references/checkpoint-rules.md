# Checkpoint rules

The reading record is an ordered collection containing zero or more checkpoints. The number is an editorial choice: use only the pauses that improve the chapter. Existing `commit`, `work`, and `reconcile` keys remain valid for compatibility, but they are a template rather than required positions. New checkpoints use unique, stable lowercase keys such as `checkpoint-a12bc34d`; do not change a checkpoint's key or server-assigned `checkpointId` merely to revise its copy.

Each checkpoint needs an existing passage anchor, a stable excerpt hash, a supported strategy, and a clear response structure. Multiple checkpoints may share a passage anchor, and their collection order controls their displayed order.

Use `get_authoring_view` and `get_passage` before drafting. Use `upsert_checkpoint` for create/revision and `reorder_checkpoint` with the complete known checkpoint plus a new `displayOrder` for movement. Call `preview_changes` before the terminal action. When the user explicitly requests an immediate live save, call `commit_live` directly with every bound precondition unchanged; do not request a second per-change approval. Ask for a one-time MCP reconnect if the trusted grant is unavailable. Poll `get_live_commit_status` when delivery is pending. This chapter-level save never grants rights approval, authority changes, protected release promotion, or rollback.
