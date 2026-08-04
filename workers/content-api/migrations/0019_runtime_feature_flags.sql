PRAGMA foreign_keys = ON;

CREATE TABLE runtime_feature_flags (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  document_ids_json TEXT NOT NULL DEFAULT '[]',
  config_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  reason TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE runtime_feature_flag_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  document_ids_json TEXT NOT NULL,
  config_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX runtime_feature_flag_history_name_version ON runtime_feature_flag_history(name, version DESC);

CREATE TRIGGER runtime_feature_flag_audit_insert
AFTER INSERT ON runtime_feature_flags
BEGIN
  INSERT INTO runtime_feature_flag_history(name, enabled, document_ids_json, config_json, version, reason, changed_by, changed_at)
  VALUES (NEW.name, NEW.enabled, NEW.document_ids_json, NEW.config_json, NEW.version, NEW.reason, NEW.updated_by, NEW.updated_at);
END;

CREATE TRIGGER runtime_feature_flag_audit_update
AFTER UPDATE ON runtime_feature_flags
BEGIN
  INSERT INTO runtime_feature_flag_history(name, enabled, document_ids_json, config_json, version, reason, changed_by, changed_at)
  VALUES (NEW.name, NEW.enabled, NEW.document_ids_json, NEW.config_json, NEW.version, NEW.reason, NEW.updated_by, NEW.updated_at);
END;

INSERT INTO runtime_feature_flags(name, enabled, document_ids_json, config_json, reason, updated_by, updated_at) VALUES
  ('shared_renderer', 0, '["chapter_ch05","chapter_ch07"]', '{}', 'Initial disabled canary', 'migration_0019', CURRENT_TIMESTAMP),
  ('server_public_projection', 0, '["chapter_ch07"]', '{}', 'Initial disabled canary', 'migration_0019', CURRENT_TIMESTAMP),
  ('unified_editor', 0, '["chapter_ch07"]', '{}', 'Initial disabled canary', 'migration_0019', CURRENT_TIMESTAMP);
