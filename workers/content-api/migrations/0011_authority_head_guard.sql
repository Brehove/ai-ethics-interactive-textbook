-- Strengthen the active-release guard: the D1 canonical head must already have
-- been promoted to the exact release revision/hash in the same atomic batch.
DROP TRIGGER authority_d1_requires_active_release;

CREATE TRIGGER authority_d1_requires_active_release
BEFORE INSERT ON authority_registry
WHEN NEW.active = 1 AND NEW.authority = 'd1' AND NOT EXISTS (
    SELECT 1
    FROM release_pointers p
    JOIN release_authority_entries e ON e.release_id = p.release_id
    JOIN releases r ON r.id = p.release_id
    JOIN documents d ON d.id = e.document_id
    WHERE p.name = 'active'
      AND r.state = 'published'
      AND e.document_id = NEW.document_id
      AND e.authority = 'd1'
      AND e.source_revision = NEW.source_revision
      AND e.normalized_snapshot_hash = NEW.normalized_snapshot_hash
      AND d.current_revision_id = NEW.source_revision
      AND d.current_content_hash = NEW.normalized_snapshot_hash
  )
BEGIN
  SELECT RAISE(ABORT, 'authority_d1_active_release_required');
END;
