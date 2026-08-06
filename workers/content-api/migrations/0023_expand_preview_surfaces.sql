PRAGMA foreign_keys = ON;

CREATE TABLE preview_grants_v2 (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  changeset_id TEXT NOT NULL REFERENCES changesets(id) ON DELETE CASCADE,
  snapshot_hash TEXT NOT NULL,
  r2_object_key TEXT NOT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('web', 'webWide', 'webNarrow', 'mobile', 'print', 'offline', 'noJs')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  CHECK (r2_object_key = 'previews/' || snapshot_hash || '.json')
);

INSERT INTO preview_grants_v2 (
  id,
  token_hash,
  changeset_id,
  snapshot_hash,
  r2_object_key,
  surface,
  created_by,
  created_at,
  expires_at,
  consumed_at
)
SELECT
  id,
  token_hash,
  changeset_id,
  snapshot_hash,
  r2_object_key,
  surface,
  created_by,
  created_at,
  expires_at,
  consumed_at
FROM preview_grants;

DROP TABLE preview_grants;
ALTER TABLE preview_grants_v2 RENAME TO preview_grants;

CREATE INDEX preview_grants_expiry ON preview_grants(expires_at, consumed_at);
