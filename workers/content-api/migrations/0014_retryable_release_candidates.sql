PRAGMA foreign_keys = ON;

-- A candidate is the approved content snapshot, not a deployment attempt.
-- Preserve every attempt as a separate immutable release/Worker-version row,
-- including abandoned attempts, while retaining efficient candidate history.
DROP INDEX releases_candidate_id;
CREATE INDEX releases_candidate_id ON releases(candidate_id) WHERE candidate_id IS NOT NULL;
