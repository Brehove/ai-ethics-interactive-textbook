PRAGMA foreign_keys = ON;

ALTER TABLE upload_tickets ADD COLUMN filename TEXT;
ALTER TABLE upload_tickets ADD COLUMN declared_bytes INTEGER;
ALTER TABLE upload_tickets ADD COLUMN uploaded_bytes INTEGER;
ALTER TABLE upload_tickets ADD COLUMN upload_token_hash TEXT;
ALTER TABLE upload_tickets ADD COLUMN month_key TEXT;
ALTER TABLE upload_tickets ADD COLUMN storage_reservation_bytes INTEGER;
ALTER TABLE upload_tickets ADD COLUMN job_id TEXT;
ALTER TABLE upload_tickets ADD COLUMN request_json TEXT;

CREATE TABLE media_budget_global (
  id TEXT PRIMARY KEY CHECK (id = 'global'),
  storage_limit_bytes INTEGER NOT NULL DEFAULT 8589934592 CHECK (storage_limit_bytes = 8589934592),
  stored_bytes INTEGER NOT NULL DEFAULT 0 CHECK (stored_bytes >= 0),
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  updated_at TEXT NOT NULL,
  CHECK (stored_bytes + reserved_bytes <= storage_limit_bytes)
);

CREATE TABLE media_budget_monthly (
  month_key TEXT PRIMARY KEY,
  ingest_limit_bytes INTEGER NOT NULL DEFAULT 1073741824 CHECK (ingest_limit_bytes = 1073741824),
  ingested_bytes INTEGER NOT NULL DEFAULT 0 CHECK (ingested_bytes >= 0),
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  updated_at TEXT NOT NULL,
  CHECK (ingested_bytes + reserved_bytes <= ingest_limit_bytes)
);

CREATE TABLE media_jobs (
  id TEXT PRIMARY KEY,
  upload_ticket_id TEXT NOT NULL UNIQUE REFERENCES upload_tickets(id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('awaiting_upload', 'queued', 'processing', 'ready', 'failed')),
  envelope_object_key TEXT UNIQUE,
  envelope_hash TEXT,
  manifest_object_key TEXT,
  error_code TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX media_jobs_state_updated ON media_jobs(state, updated_at);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('processing', 'ready', 'blocked')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE media_asset_versions (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  source_sha256 TEXT NOT NULL UNIQUE,
  source_bytes INTEGER NOT NULL,
  detected_mime TEXT NOT NULL,
  immutable_address TEXT NOT NULL UNIQUE,
  manifest_object_key TEXT NOT NULL UNIQUE,
  technical_json TEXT NOT NULL,
  derivatives_json TEXT NOT NULL,
  processor_version TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX media_asset_versions_media ON media_asset_versions(media_id, created_at DESC);

CREATE TABLE media_rights_cases (
  id TEXT PRIMARY KEY,
  media_version_id TEXT NOT NULL REFERENCES media_asset_versions(id) ON DELETE RESTRICT,
  review_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reviewRequired', 'cleared', 'blocked')),
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (media_version_id, review_id)
);

CREATE TABLE media_processor_callbacks (
  idempotency_key TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES media_jobs(id) ON DELETE RESTRICT,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
