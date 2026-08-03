PRAGMA foreign_keys = OFF;

ALTER TABLE submitted_snapshot_media_assets RENAME TO submitted_snapshot_media_assets_v1;
ALTER TABLE media_version_objects RENAME TO media_version_objects_v1;
DROP INDEX submitted_snapshot_media_sha256;
DROP INDEX media_version_objects_version;
DROP INDEX media_version_objects_sha256;

CREATE TABLE media_version_objects (
  id TEXT PRIMARY KEY,
  media_version_id TEXT NOT NULL REFERENCES media_asset_versions(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('derivative', 'poster', 'responsive-640', 'responsive-1280', 'responsive-1920')),
  object_key TEXT NOT NULL UNIQUE,
  object_sha256 TEXT NOT NULL,
  object_bytes INTEGER NOT NULL CHECK (object_bytes > 0),
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (media_version_id, role)
);
INSERT INTO media_version_objects SELECT * FROM media_version_objects_v1;
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
  role TEXT NOT NULL CHECK (role IN ('derivative', 'poster', 'responsive-640', 'responsive-1280', 'responsive-1920')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, object_id),
  UNIQUE (snapshot_id, object_key)
);
INSERT INTO submitted_snapshot_media_assets SELECT * FROM submitted_snapshot_media_assets_v1;
CREATE INDEX submitted_snapshot_media_sha256 ON submitted_snapshot_media_assets(object_sha256, snapshot_id);

DROP TABLE submitted_snapshot_media_assets_v1;
DROP TABLE media_version_objects_v1;
PRAGMA foreign_keys = ON;
