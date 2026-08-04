PRAGMA foreign_keys = ON;

-- Minimal, read-only mirror consumed by the service-bound public projection
-- Worker. Actor, reason, configuration, and history remain private.
CREATE TABLE public_runtime_feature_flags (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  document_ids_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL CHECK (version >= 1),
  updated_at TEXT NOT NULL
);

INSERT INTO public_runtime_feature_flags(name, enabled, document_ids_json, version, updated_at)
SELECT name, enabled, document_ids_json, version, updated_at FROM runtime_feature_flags;

DROP TRIGGER runtime_feature_flag_audit_insert;
DROP TRIGGER runtime_feature_flag_audit_update;

CREATE TRIGGER runtime_feature_flag_audit_insert
AFTER INSERT ON runtime_feature_flags
BEGIN
  INSERT INTO runtime_feature_flag_history(name, enabled, document_ids_json, config_json, version, reason, changed_by, changed_at)
  VALUES (NEW.name, NEW.enabled, NEW.document_ids_json, NEW.config_json, NEW.version, NEW.reason, NEW.updated_by, NEW.updated_at);
  INSERT INTO public_runtime_feature_flags(name, enabled, document_ids_json, version, updated_at)
  VALUES (NEW.name, NEW.enabled, NEW.document_ids_json, NEW.version, NEW.updated_at)
  ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled, document_ids_json = excluded.document_ids_json, version = excluded.version, updated_at = excluded.updated_at;
END;

CREATE TRIGGER runtime_feature_flag_audit_update
AFTER UPDATE ON runtime_feature_flags
BEGIN
  INSERT INTO runtime_feature_flag_history(name, enabled, document_ids_json, config_json, version, reason, changed_by, changed_at)
  VALUES (NEW.name, NEW.enabled, NEW.document_ids_json, NEW.config_json, NEW.version, NEW.reason, NEW.updated_by, NEW.updated_at);
  INSERT INTO public_runtime_feature_flags(name, enabled, document_ids_json, version, updated_at)
  VALUES (NEW.name, NEW.enabled, NEW.document_ids_json, NEW.version, NEW.updated_at)
  ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled, document_ids_json = excluded.document_ids_json, version = excluded.version, updated_at = excluded.updated_at;
END;
