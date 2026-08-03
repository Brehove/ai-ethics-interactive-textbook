-- Review-history and provenance additions. Nullable columns preserve existing rows;
-- all new API writes populate the actor, client, and run lineage.
ALTER TABLE changesets ADD COLUMN created_actor_type TEXT;
ALTER TABLE changesets ADD COLUMN created_client_id TEXT;
ALTER TABLE changesets ADD COLUMN created_run_id TEXT;
ALTER TABLE changesets ADD COLUMN restored_from_revision_id TEXT REFERENCES document_revisions(id);

ALTER TABLE document_revisions ADD COLUMN created_actor_type TEXT;
ALTER TABLE document_revisions ADD COLUMN created_client_id TEXT;
ALTER TABLE document_revisions ADD COLUMN created_run_id TEXT;

ALTER TABLE audit_events ADD COLUMN actor_type TEXT;

CREATE INDEX changesets_restored_revision ON changesets(restored_from_revision_id);
