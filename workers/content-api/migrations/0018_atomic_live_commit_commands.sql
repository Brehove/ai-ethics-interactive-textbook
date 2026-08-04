PRAGMA foreign_keys = ON;

CREATE TABLE live_commit_commands (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  changeset_id TEXT NOT NULL REFERENCES changesets(id) ON DELETE RESTRICT,
  working_document_id TEXT NOT NULL REFERENCES working_documents(id) ON DELETE RESTRICT,
  expected_authority_id TEXT NOT NULL REFERENCES authority_registry(id) ON DELETE RESTRICT,
  expected_base_revision_id TEXT NOT NULL REFERENCES document_revisions(id) ON DELETE RESTRICT,
  expected_working_version INTEGER NOT NULL CHECK (expected_working_version >= 1),
  result_revision_id TEXT,
  result_content_hash TEXT CHECK (result_content_hash IS NULL OR length(result_content_hash) = 64),
  projection_id TEXT,
  projection_hash TEXT CHECK (projection_hash IS NULL OR length(projection_hash) = 64),
  state TEXT NOT NULL CHECK (state IN ('committing', 'committed', 'unchanged', 'failed')),
  public_url TEXT NOT NULL,
  response_status INTEGER,
  response_json TEXT,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'service')),
  client_id TEXT,
  run_id TEXT,
  created_at TEXT NOT NULL,
  committed_at TEXT,
  UNIQUE (actor_id, idempotency_key)
);
CREATE INDEX live_commit_commands_document_created ON live_commit_commands(document_id, created_at DESC);
CREATE TABLE live_commit_delivery_status (
  command_id TEXT PRIMARY KEY REFERENCES live_commit_commands(id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('confirmation_pending', 'verified')),
  last_checked_at TEXT,
  verified_at TEXT,
  observed_revision_id TEXT,
  observed_projection_hash TEXT CHECK (observed_projection_hash IS NULL OR length(observed_projection_hash) = 64),
  status_expires_at TEXT NOT NULL
);
CREATE INDEX live_commit_delivery_status_pending ON live_commit_delivery_status(state, status_expires_at);

-- This trigger executes inside the same D1 batch that writes the immutable
-- revision and public projection. Any stale authority/head/working version
-- raises ABORT, so the batch creates no orphan revision or projection.
CREATE TRIGGER live_commit_exact_authority
BEFORE INSERT ON live_commit_commands
WHEN NEW.state = 'committing' AND NOT EXISTS (
  SELECT 1 FROM authority_registry a
  WHERE a.id = NEW.expected_authority_id
    AND a.document_id = NEW.document_id
    AND a.active = 1
    AND a.authority = 'd1'
)
BEGIN
  SELECT RAISE(ABORT, 'D1_AUTHORITY_REQUIRED');
END;

CREATE TRIGGER live_commit_exact_preconditions
BEFORE INSERT ON live_commit_commands
WHEN NEW.state = 'committing' AND NOT EXISTS (
  SELECT 1
  FROM documents d
  JOIN working_documents w ON w.id = NEW.working_document_id
  JOIN changesets c ON c.id = NEW.changeset_id
  WHERE d.id = NEW.document_id
    AND d.state = 'active'
    AND d.current_revision_id = NEW.expected_base_revision_id
    AND w.document_id = d.id
    AND w.changeset_id = c.id
    AND w.base_revision_id = NEW.expected_base_revision_id
    AND w.version = NEW.expected_working_version
    AND c.state = 'open'
)
BEGIN
  SELECT RAISE(ABORT, 'REVISION_CONFLICT');
END;

CREATE TRIGGER live_commit_document_head_exact
BEFORE UPDATE OF current_revision_id, current_content_hash ON documents
WHEN NEW.current_revision_id <> OLD.current_revision_id
  AND EXISTS (SELECT 1 FROM document_revisions r WHERE r.id = NEW.current_revision_id AND json_extract(r.metadata_json, '$.publicationMode') = 'instructor-live-save')
  AND NOT EXISTS (
    SELECT 1 FROM live_commit_commands c
    JOIN document_revisions r ON r.id = NEW.current_revision_id
    WHERE c.id = json_extract(r.metadata_json, '$.liveCommitCommandId')
      AND c.document_id = NEW.id
      AND c.expected_base_revision_id = OLD.current_revision_id
      AND r.parent_revision_id = OLD.current_revision_id
      AND r.content_hash = NEW.current_content_hash
  )
BEGIN
  SELECT RAISE(ABORT, 'live_commit_document_head_mismatch');
END;
