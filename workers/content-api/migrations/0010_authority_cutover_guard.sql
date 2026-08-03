-- A document may become D1-authoritative only after the exact revision/hash is
-- already represented by the active, receipt-backed release. This trigger is
-- the final race-safe guard beneath the service API.
CREATE TRIGGER authority_d1_requires_active_release
BEFORE INSERT ON authority_registry
WHEN NEW.active = 1 AND NEW.authority = 'd1' AND NOT EXISTS (
    SELECT 1
    FROM release_pointers p
    JOIN release_authority_entries e ON e.release_id = p.release_id
    JOIN releases r ON r.id = p.release_id
    WHERE p.name = 'active'
      AND r.state = 'published'
      AND e.document_id = NEW.document_id
      AND e.authority = 'd1'
      AND e.source_revision = NEW.source_revision
      AND e.normalized_snapshot_hash = NEW.normalized_snapshot_hash
  )
BEGIN
  SELECT RAISE(ABORT, 'authority_d1_active_release_required');
END;
