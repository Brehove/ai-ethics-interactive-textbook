PRAGMA foreign_keys = ON;

CREATE TABLE mcp_oauth_authorization_requests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  resource TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  state_value TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_hash TEXT UNIQUE,
  requested_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  code_issued_at TEXT,
  code_consumed_at TEXT
);

CREATE INDEX mcp_oauth_authorization_expiry
  ON mcp_oauth_authorization_requests(expires_at);

CREATE TABLE mcp_oauth_grants (
  id TEXT PRIMARY KEY,
  access_jti TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  claims_hash TEXT NOT NULL UNIQUE CHECK (length(claims_hash) = 64),
  scopes_json TEXT NOT NULL,
  allowed_document_ids_json TEXT NOT NULL,
  allowed_operations_json TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE CHECK (length(refresh_token_hash) = 64),
  issued_at TEXT NOT NULL,
  access_expires_at TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  refreshed_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT,
  revocation_reason TEXT,
  authorization_request_id TEXT NOT NULL REFERENCES mcp_oauth_authorization_requests(id) ON DELETE RESTRICT
);

CREATE INDEX mcp_oauth_grants_actor
  ON mcp_oauth_grants(actor_id, issued_at DESC);

ALTER TABLE agent_capability_requests ADD COLUMN parent_oauth_jti TEXT;
ALTER TABLE agent_capability_requests ADD COLUMN target_json TEXT;
