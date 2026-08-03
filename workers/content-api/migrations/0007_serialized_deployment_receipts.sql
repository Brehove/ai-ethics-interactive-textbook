PRAGMA foreign_keys = ON;

-- A release is staged before the protected GitHub workflow changes Cloudflare
-- traffic. Only one non-expired staged transaction may exist for the book.
ALTER TABLE releases ADD COLUMN candidate_id TEXT;
ALTER TABLE releases ADD COLUMN snapshot_hash TEXT;
ALTER TABLE releases ADD COLUMN snapshot_revision TEXT;
ALTER TABLE releases ADD COLUMN build_attestation_hash TEXT;
ALTER TABLE releases ADD COLUMN cloudflare_version_id TEXT;
CREATE UNIQUE INDEX releases_candidate_id ON releases(candidate_id) WHERE candidate_id IS NOT NULL;

CREATE TABLE release_deployment_transactions (
  id TEXT PRIMARY KEY,
  book_key TEXT NOT NULL DEFAULT 'book_phil_123_ai_ethics' CHECK (book_key = 'book_phil_123_ai_ethics'),
  action TEXT NOT NULL CHECK (action IN ('promote', 'rollback')),
  state TEXT NOT NULL CHECK (state IN ('staged', 'completed', 'abandoned', 'failed')),
  release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE RESTRICT,
  candidate_id TEXT,
  submitted_snapshot_id TEXT REFERENCES submitted_snapshots(id) ON DELETE RESTRICT,
  snapshot_hash TEXT,
  snapshot_revision TEXT,
  candidate_manifest_hash TEXT NOT NULL,
  build_attestation_hash TEXT NOT NULL,
  expected_active_release_id TEXT REFERENCES releases(id) ON DELETE RESTRICT,
  cloudflare_version_id TEXT NOT NULL,
  staged_by TEXT NOT NULL,
  staged_client_id TEXT NOT NULL,
  staged_run_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK ((action = 'promote' AND candidate_id IS NOT NULL AND submitted_snapshot_id IS NOT NULL AND snapshot_hash IS NOT NULL AND snapshot_revision IS NOT NULL)
      OR (action = 'rollback' AND candidate_id IS NULL))
);
CREATE UNIQUE INDEX release_deployment_one_staged_book
  ON release_deployment_transactions(book_key) WHERE state = 'staged';
CREATE INDEX release_deployment_release ON release_deployment_transactions(release_id, created_at DESC);

CREATE TABLE deployment_receipts (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE REFERENCES release_deployment_transactions(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('promote', 'rollback')),
  release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE RESTRICT,
  previous_active_release_id TEXT REFERENCES releases(id) ON DELETE RESTRICT,
  candidate_id TEXT,
  candidate_manifest_hash TEXT NOT NULL,
  build_attestation_hash TEXT NOT NULL,
  snapshot_hash TEXT,
  snapshot_revision TEXT,
  cloudflare_deployment_id TEXT NOT NULL UNIQUE,
  cloudflare_version_id TEXT NOT NULL,
  verification_hash TEXT NOT NULL,
  receipt_hash TEXT NOT NULL UNIQUE,
  recorded_by TEXT NOT NULL,
  recorded_client_id TEXT NOT NULL,
  recorded_run_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX deployment_receipts_release ON deployment_receipts(release_id, created_at DESC);

CREATE TABLE release_pointer_history (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id TEXT NOT NULL UNIQUE REFERENCES deployment_receipts(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('promote', 'rollback')),
  previous_release_id TEXT REFERENCES releases(id) ON DELETE RESTRICT,
  release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE RESTRICT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

-- Inserting a pointer command is the sole active-pointer mutation path. The
-- BEFORE trigger makes expected-active comparison and pointer advancement one
-- D1 transaction with the deployment receipt. A stale concurrent command
-- aborts the entire D1 batch, including its receipt.
CREATE TABLE release_pointer_commands (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL UNIQUE REFERENCES deployment_receipts(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('promote', 'rollback')),
  expected_active_release_id TEXT REFERENCES releases(id) ON DELETE RESTRICT,
  release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE RESTRICT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

CREATE TRIGGER release_pointer_commands_expected_active
BEFORE INSERT ON release_pointer_commands
WHEN
  (NEW.expected_active_release_id IS NULL AND EXISTS (SELECT 1 FROM release_pointers WHERE name = 'active'))
  OR
  (NEW.expected_active_release_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM release_pointers WHERE name = 'active' AND release_id = NEW.expected_active_release_id
  ))
BEGIN
  SELECT RAISE(ABORT, 'RELEASE_POINTER_CAS_MISMATCH');
END;

CREATE TRIGGER release_pointer_commands_apply
AFTER INSERT ON release_pointer_commands
BEGIN
  INSERT INTO release_pointers (name, release_id, updated_by, updated_at)
    VALUES ('active', NEW.release_id, NEW.changed_by, NEW.changed_at)
    ON CONFLICT(name) DO UPDATE SET
      release_id = excluded.release_id,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  INSERT INTO release_pointer_history
    (receipt_id, action, previous_release_id, release_id, changed_by, changed_at)
    VALUES (NEW.receipt_id, NEW.action, NEW.expected_active_release_id, NEW.release_id, NEW.changed_by, NEW.changed_at);
END;
