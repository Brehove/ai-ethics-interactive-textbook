PRAGMA foreign_keys = ON;

CREATE TABLE preview_grants (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  changeset_id TEXT NOT NULL REFERENCES changesets(id) ON DELETE CASCADE,
  snapshot_hash TEXT NOT NULL,
  r2_object_key TEXT NOT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('web', 'mobile', 'print', 'offline')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  CHECK (r2_object_key = 'previews/' || snapshot_hash || '.json')
);
CREATE INDEX preview_grants_expiry ON preview_grants(expires_at, consumed_at);
