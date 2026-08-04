PRAGMA foreign_keys = ON;

-- Preserve media_rights_cases.status (reviewRequired | cleared | blocked).
-- A cleared case now additionally needs one immutable, typed basis receipt.
CREATE TABLE rights_clearance_receipts (
  id TEXT PRIMARY KEY,
  rights_case_id TEXT NOT NULL UNIQUE REFERENCES media_rights_cases(id) ON DELETE RESTRICT,
  basis TEXT NOT NULL CHECK (basis IN ('humanApproval', 'policy')),
  policy_version TEXT,
  evidence_receipt_id TEXT,
  subject_hash TEXT NOT NULL CHECK (length(subject_hash) = 64),
  issued_at TEXT NOT NULL,
  created_at TEXT NOT NULL
  CHECK ((basis = 'humanApproval' AND policy_version IS NULL AND evidence_receipt_id IS NULL)
    OR (basis = 'policy' AND policy_version IS NOT NULL AND evidence_receipt_id IS NOT NULL))
);
CREATE INDEX rights_clearance_receipts_policy ON rights_clearance_receipts(policy_version, basis);

-- Existing rows remain readable during backfill. Release gates must join this
-- receipt for status = 'cleared' once the contract version is activated.
