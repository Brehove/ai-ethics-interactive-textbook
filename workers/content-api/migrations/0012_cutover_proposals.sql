ALTER TABLE changesets ADD COLUMN purpose TEXT NOT NULL DEFAULT 'authoring'
  CHECK (purpose IN ('authoring', 'authority_cutover'));

CREATE INDEX idx_changesets_purpose_state ON changesets(purpose, state, updated_at);
