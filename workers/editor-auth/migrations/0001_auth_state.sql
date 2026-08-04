PRAGMA foreign_keys = ON;

CREATE TABLE agent_capability_requests (
  id TEXT PRIMARY KEY,
  device_secret_hash TEXT NOT NULL UNIQUE CHECK (length(device_secret_hash) = 64),
  user_code_hash TEXT NOT NULL UNIQUE CHECK (length(user_code_hash) = 64),
  client_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  allowed_document_ids_json TEXT NOT NULL,
  allowed_operations_json TEXT NOT NULL,
  requested_lifetime_seconds INTEGER NOT NULL CHECK (requested_lifetime_seconds BETWEEN 60 AND 900),
  state TEXT NOT NULL CHECK (state IN ('pending', 'approved', 'denied', 'consumed', 'expired')),
  requested_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  consumed_at TEXT,
  live_save_step_up_at TEXT
);

CREATE TABLE agent_capability_grants (
  jti TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  claims_hash TEXT NOT NULL UNIQUE CHECK (length(claims_hash) = 64),
  scopes_json TEXT NOT NULL,
  allowed_document_ids_json TEXT NOT NULL,
  allowed_operations_json TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT,
  revocation_reason TEXT,
  issuance_request_id TEXT NOT NULL UNIQUE REFERENCES agent_capability_requests(id) ON DELETE RESTRICT
);

CREATE TABLE agent_capability_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  actor_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX agent_capability_audit_subject ON agent_capability_audit(subject_id, created_at DESC);
