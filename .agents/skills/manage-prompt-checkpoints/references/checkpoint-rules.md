# Checkpoint rules

The reading record is an ordered collection containing zero or more checkpoints. The number is an editorial choice: use only the pauses that improve the chapter. Existing `commit`, `work`, and `reconcile` keys remain valid for compatibility, but they are a template rather than required positions. New checkpoints use unique, stable lowercase keys such as `checkpoint-a12bc34d`; do not change a checkpoint's key or server-assigned `checkpointId` merely to revise its copy.

Each checkpoint needs an existing passage anchor, a stable excerpt hash, a supported strategy, and a clear response structure. Multiple checkpoints may share a passage anchor, and their collection order controls their displayed order.

Use `list_passages` before drafting, following `page.nextCursor` until the needed anchor is found. Validate before submission. Normal agents do not approve, reject, or publish under any ordinary authority; hand the exact submitted snapshot identity to the separate human release path.
