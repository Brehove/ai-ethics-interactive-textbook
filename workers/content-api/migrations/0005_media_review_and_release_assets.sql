PRAGMA foreign_keys = ON;

CREATE TABLE media_review_packages (
  id TEXT PRIMARY KEY,
  rights_review_id TEXT NOT NULL UNIQUE,
  editorial_review_id TEXT NOT NULL UNIQUE,
  accessibility_review_id TEXT NOT NULL UNIQUE,
  declaration_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'cleared', 'rejected')),
  rights_json TEXT NOT NULL,
  editorial_json TEXT NOT NULL,
  accessibility_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_actor_type TEXT NOT NULL,
  created_client_id TEXT NOT NULL,
  created_run_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decided_by TEXT,
  decision_comment TEXT,
  decided_at TEXT
);

ALTER TABLE upload_tickets ADD COLUMN review_package_id TEXT REFERENCES media_review_packages(id);
ALTER TABLE media_rights_cases ADD COLUMN review_package_id TEXT REFERENCES media_review_packages(id);

CREATE TABLE media_version_objects (
  id TEXT PRIMARY KEY,
  media_version_id TEXT NOT NULL REFERENCES media_asset_versions(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('derivative', 'poster')),
  object_key TEXT NOT NULL UNIQUE,
  object_sha256 TEXT NOT NULL,
  object_bytes INTEGER NOT NULL CHECK (object_bytes > 0),
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (media_version_id, role)
);
CREATE INDEX media_version_objects_version ON media_version_objects(media_version_id);
CREATE INDEX media_version_objects_sha256 ON media_version_objects(object_sha256);

CREATE TABLE submitted_snapshot_media_assets (
  snapshot_id TEXT NOT NULL REFERENCES submitted_snapshots(id) ON DELETE RESTRICT,
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  media_version_id TEXT NOT NULL REFERENCES media_asset_versions(id) ON DELETE RESTRICT,
  rights_case_id TEXT NOT NULL REFERENCES media_rights_cases(id) ON DELETE RESTRICT,
  object_id TEXT NOT NULL REFERENCES media_version_objects(id) ON DELETE RESTRICT,
  object_sha256 TEXT NOT NULL,
  object_key TEXT NOT NULL,
  object_bytes INTEGER NOT NULL CHECK (object_bytes > 0),
  content_type TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('derivative', 'poster')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, object_id),
  UNIQUE (snapshot_id, object_key)
);
CREATE INDEX submitted_snapshot_media_sha256 ON submitted_snapshot_media_assets(object_sha256, snapshot_id);
