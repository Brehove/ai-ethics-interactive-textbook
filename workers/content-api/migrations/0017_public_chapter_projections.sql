PRAGMA foreign_keys = ON;

-- Immutable, renderer-owned chapter bytes. Only this public_* projection is
-- readable through the service-bound Public Projection Worker.
CREATE TABLE public_chapter_projections (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  revision_id TEXT NOT NULL REFERENCES document_revisions(id) ON DELETE RESTRICT,
  chapter_version TEXT NOT NULL,
  renderer_version TEXT NOT NULL,
  stylesheet_version TEXT NOT NULL,
  stylesheet_hash TEXT NOT NULL CHECK (length(stylesheet_hash) = 64),
  projection_hash TEXT NOT NULL UNIQUE CHECK (length(projection_hash) = 64),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL,
  html TEXT NOT NULL,
  prompts_json TEXT NOT NULL,
  managed_assets_json TEXT NOT NULL DEFAULT '[]',
  schema_version INTEGER NOT NULL,
  generated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (document_id, revision_id, renderer_version, stylesheet_hash)
);
CREATE INDEX public_chapter_projections_document_revision ON public_chapter_projections(document_id, revision_id, created_at DESC);

-- Immutable public derivatives referenced by accepted projections. The
-- public-projection Worker can look up only this allowlisted metadata table,
-- then stream the exact hash-addressed object from the public media bucket.
CREATE TABLE public_media_assets (
  sha256 TEXT PRIMARY KEY CHECK (length(sha256) = 64),
  object_key TEXT NOT NULL UNIQUE CHECK (object_key LIKE 'media/%' AND instr(object_key, '..') = 0),
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE public_chapter_heads (
  document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES document_revisions(id) ON DELETE RESTRICT,
  projection_id TEXT NOT NULL REFERENCES public_chapter_projections(id) ON DELETE RESTRICT,
  projection_hash TEXT NOT NULL CHECK (length(projection_hash) = 64),
  stylesheet_version TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TRIGGER public_chapter_head_exact_projection
BEFORE INSERT ON public_chapter_heads
WHEN NOT EXISTS (
  SELECT 1 FROM public_chapter_projections p
  WHERE p.id = NEW.projection_id AND p.document_id = NEW.document_id
    AND p.revision_id = NEW.revision_id AND p.projection_hash = NEW.projection_hash
    AND p.stylesheet_version = NEW.stylesheet_version
)
BEGIN
  SELECT RAISE(ABORT, 'public_head_projection_mismatch');
END;

CREATE TRIGGER public_chapter_head_exact_projection_update
BEFORE UPDATE ON public_chapter_heads
WHEN NOT EXISTS (
  SELECT 1 FROM public_chapter_projections p
  WHERE p.id = NEW.projection_id AND p.document_id = NEW.document_id
    AND p.revision_id = NEW.revision_id AND p.projection_hash = NEW.projection_hash
    AND p.stylesheet_version = NEW.stylesheet_version
)
BEGIN
  SELECT RAISE(ABORT, 'public_head_projection_mismatch');
END;
