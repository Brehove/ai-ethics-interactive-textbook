# Checkpoint rules

The reading record is an ordered collection containing zero or more checkpoints. The number is an editorial choice: use only the pauses that improve the chapter. Existing `commit`, `work`, and `reconcile` keys remain valid for compatibility, but they are a template rather than required positions. New checkpoints use unique, stable lowercase keys such as `checkpoint-a12bc34d`; do not change a checkpoint's key or server-assigned `checkpointId` merely to revise its copy.

Each checkpoint needs an existing passage anchor, a stable excerpt hash, a supported strategy, and a clear response structure. Multiple checkpoints may share a passage anchor, and their collection order controls their displayed order.

Use `list_passages` before drafting, following `page.nextCursor` until the needed anchor is found. Validate and inspect the diff before the terminal action. Submit for human review by default. When the user explicitly requests an immediate live save and the capability receipt reports `maySaveLive: true`, `save_live_revision` may publish the validated D1-authoritative chapter as a new immutable version. This chapter-level save never grants approval, authority changes, protected release promotion, or rollback.
