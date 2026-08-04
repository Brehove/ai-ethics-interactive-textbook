-- OAuth state is intentionally separate from editorial content.  The nonce is
-- stored as a hash because it is also carried in the signed browser state; the
-- PKCE verifier must remain server-side in recoverable form until one callback.
CREATE TABLE oauth_authorization_states (
  nonce_hash TEXT PRIMARY KEY CHECK (length(nonce_hash) = 64),
  pkce_verifier TEXT NOT NULL CHECK (length(pkce_verifier) BETWEEN 43 AND 128),
  chapter_slug TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode = 'edit'),
  anchor_id TEXT,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX oauth_authorization_states_expiry
  ON oauth_authorization_states(expires_at);
