PRAGMA foreign_keys = ON;

-- Immutable person revisions and placements are normalized alongside, not inside,
-- editable prose. Chapter JSON remains compatible while the importer/backfill
-- writes these records for the next-generation renderer and editor.
CREATE TABLE person_entity_revisions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  source_path TEXT NOT NULL,
  projection_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (person_id, content_hash)
);

CREATE TABLE chapter_person_relations (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  role TEXT NOT NULL,
  passage_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (document_id, person_id)
);

CREATE TABLE managed_content_records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('personFeature', 'media', 'embed', 'diagram', 'artifact')),
  entity_revision_id TEXT REFERENCES person_entity_revisions(id) ON DELETE RESTRICT,
  frozen_projection_json TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  created_at TEXT NOT NULL,
  CHECK ((kind = 'personFeature' AND entity_revision_id IS NOT NULL) OR kind <> 'personFeature')
);

CREATE TABLE managed_placements (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('personFeature', 'media', 'embed', 'diagram', 'artifact')),
  content_id TEXT NOT NULL REFERENCES managed_content_records(id) ON DELETE RESTRICT,
  anchor_passage_id TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('before', 'after')),
  order_at_anchor INTEGER NOT NULL CHECK (order_at_anchor >= 0),
  display_preset TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (document_id, anchor_passage_id, position, order_at_anchor)
);
CREATE INDEX managed_placements_document_anchor ON managed_placements(document_id, anchor_passage_id, position, order_at_anchor);

-- Checkpoint data was historically embedded in documents and keyed by an
-- exclusive slot. Keep the old JSON readable, but establish the canonical
-- independent key/order model for all new writes and deterministic backfill.
CREATE TABLE chapter_checkpoints (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  legacy_id TEXT,
  passage_id TEXT NOT NULL,
  passage_excerpt_hash TEXT NOT NULL CHECK (length(passage_excerpt_hash) = 64),
  display_order INTEGER NOT NULL CHECK (display_order >= 0),
  slot_label TEXT,
  checkpoint_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (document_id, id)
);
CREATE INDEX chapter_checkpoints_document_order ON chapter_checkpoints(document_id, display_order, id);

-- No unique slot index is introduced: stage and slot_label are pedagogical
-- metadata, so multiple checkpoints may share them and one passage.
