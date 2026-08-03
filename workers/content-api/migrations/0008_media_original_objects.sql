PRAGMA foreign_keys = ON;

-- Exact uploaded originals remain private and are never projected into a
-- public release. Public snapshots may reference only reviewed derivative or
-- poster objects from media_version_objects.
CREATE TABLE media_original_objects (
  id TEXT PRIMARY KEY,
  media_version_id TEXT NOT NULL UNIQUE REFERENCES media_asset_versions(id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL UNIQUE,
  object_sha256 TEXT NOT NULL,
  object_bytes INTEGER NOT NULL CHECK (object_bytes > 0),
  content_type TEXT NOT NULL,
  private INTEGER NOT NULL DEFAULT 1 CHECK (private = 1),
  created_at TEXT NOT NULL
);
CREATE INDEX media_original_objects_sha256 ON media_original_objects(object_sha256);
