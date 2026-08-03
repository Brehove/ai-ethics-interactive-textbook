-- Canonical content control plane. R2 objects are addressed by immutable keys;
-- D1 remains the authoritative metadata, revision, workflow, and audit store.
PRAGMA foreign_keys = ON;

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  canonical_path TEXT NOT NULL UNIQUE,
  media_kind TEXT NOT NULL DEFAULT 'text',
  title TEXT,
  current_revision_id TEXT,
  current_content_hash TEXT,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE document_revisions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  parent_revision_id TEXT REFERENCES document_revisions(id),
  content_hash TEXT NOT NULL,
  content_text TEXT,
  r2_object_key TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (content_text IS NOT NULL OR r2_object_key IS NOT NULL),
  UNIQUE (document_id, content_hash)
);
CREATE INDEX document_revisions_document_created ON document_revisions(document_id, created_at DESC);

CREATE TABLE authority_registry (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  authority TEXT NOT NULL CHECK (authority IN ('git', 'd1')),
  source_path TEXT,
  source_revision TEXT NOT NULL,
  normalized_snapshot_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL,
  CHECK ((authority = 'git' AND source_path IS NOT NULL) OR authority = 'd1'),
  UNIQUE (document_id, source_revision)
);
CREATE UNIQUE INDEX authority_registry_one_active_document ON authority_registry(document_id) WHERE active = 1;

-- Permissions are deliberately separate from the per-document source-of-truth map.
CREATE TABLE authority_grants (
  id TEXT PRIMARY KEY,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'service', 'group')),
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  scope_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (principal_type, principal_id, role)
);

CREATE TABLE changesets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  state TEXT NOT NULL CHECK (state IN ('open', 'submitted', 'approved', 'rejected', 'applied', 'abandoned')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  last_validation_hash TEXT,
  last_validation_json TEXT,
  applied_at TEXT
);

CREATE TABLE working_documents (
  id TEXT PRIMARY KEY,
  changeset_id TEXT NOT NULL REFERENCES changesets(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id),
  base_revision_id TEXT NOT NULL REFERENCES document_revisions(id),
  content_hash TEXT NOT NULL,
  content_text TEXT,
  r2_object_key TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  checkpoint INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (content_text IS NOT NULL OR r2_object_key IS NOT NULL),
  UNIQUE (changeset_id, document_id)
);
CREATE INDEX working_documents_changeset ON working_documents(changeset_id);

-- Submission serializes every working document into one immutable, R2-addressed snapshot.
CREATE TABLE submitted_snapshots (
  id TEXT PRIMARY KEY,
  changeset_id TEXT NOT NULL UNIQUE REFERENCES changesets(id) ON DELETE RESTRICT,
  snapshot_hash TEXT NOT NULL UNIQUE,
  snapshot_revision TEXT NOT NULL UNIQUE,
  r2_object_key TEXT NOT NULL UNIQUE,
  document_count INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE idempotency_records (
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  PRIMARY KEY (scope, idempotency_key)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_id TEXT,
  client_id TEXT,
  run_id TEXT,
  base_revision_id TEXT,
  result_revision_id TEXT,
  idempotency_hash TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX audit_events_entity ON audit_events(entity_type, entity_id, created_at DESC);

CREATE TABLE content_operations (
  id TEXT PRIMARY KEY,
  changeset_id TEXT NOT NULL REFERENCES changesets(id) ON DELETE RESTRICT,
  document_id TEXT REFERENCES documents(id),
  operation_kind TEXT NOT NULL,
  operation_json TEXT NOT NULL,
  client_id TEXT,
  run_id TEXT,
  base_revision_id TEXT,
  result_revision_id TEXT,
  idempotency_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result_hash TEXT,
  working_version INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX content_operations_changeset ON content_operations(changeset_id, created_at);
CREATE UNIQUE INDEX content_operations_working_version ON content_operations(changeset_id, document_id, working_version);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  changeset_id TEXT NOT NULL REFERENCES changesets(id) ON DELETE CASCADE,
  submitted_snapshot_id TEXT NOT NULL REFERENCES submitted_snapshots(id) ON DELETE RESTRICT,
  submitted_snapshot_hash TEXT NOT NULL,
  submitted_snapshot_revision TEXT NOT NULL,
  subject_revision_id TEXT,
  decision_kind TEXT NOT NULL CHECK (decision_kind IN ('content', 'rights', 'editorial', 'release')),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_by TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (changeset_id, submitted_snapshot_hash, decision_kind, decided_by)
);

CREATE TABLE upload_tickets (
  id TEXT PRIMARY KEY,
  changeset_id TEXT REFERENCES changesets(id) ON DELETE SET NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  content_hash TEXT,
  max_bytes INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('issued', 'uploaded', 'expired', 'consumed')),
  issued_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE provider_health (
  provider TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('healthy', 'degraded', 'unavailable', 'unknown')),
  checked_at TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE release_sequences (
  name TEXT PRIMARY KEY,
  next_sequence INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE release_locks (
  name TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL UNIQUE,
  changeset_id TEXT REFERENCES changesets(id),
  state TEXT NOT NULL CHECK (state IN ('building', 'published', 'failed', 'superseded')),
  manifest_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT
);
-- This freezes the entire source-authority map used by a release, including
-- chapters still authoritative in Git during a staged canary.
CREATE TABLE release_authority_entries (
  release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id),
  authority TEXT NOT NULL CHECK (authority IN ('git', 'd1')),
  source_path TEXT,
  source_revision TEXT NOT NULL,
  normalized_snapshot_hash TEXT NOT NULL,
  PRIMARY KEY (release_id, document_id)
);
CREATE TABLE release_pointers (
  name TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES releases(id),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
