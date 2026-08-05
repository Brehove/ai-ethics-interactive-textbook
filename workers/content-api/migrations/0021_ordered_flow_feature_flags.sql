PRAGMA foreign_keys = ON;

-- Audited, fail-closed controls for the ordered-flow rollout. This migration
-- creates control state only; it does not rewrite any chapter revision.
INSERT INTO runtime_feature_flags(name, enabled, document_ids_json, config_json, reason, updated_by, updated_at) VALUES
  ('editor_identity_normalization', 0, '["chapter_ch07"]', '{}', 'Disabled schema-v3 editor canary', 'migration_0021', CURRENT_TIMESTAMP),
  ('ordered_managed_references_v3', 0, '["chapter_ch07"]', '{}', 'Disabled schema-v3 write canary', 'migration_0021', CURRENT_TIMESTAMP),
  ('legacy_anchor_projection_adapter', 1, '["chapter_ch01","chapter_ch02","chapter_ch03","chapter_ch04","chapter_ch05","chapter_ch06","chapter_ch07","chapter_ch08","chapter_ch09","chapter_ch10","chapter_ch11","chapter_ch12","chapter_ch13","chapter_ch14","chapter_ch15","chapter_ch16","chapter_ch17","chapter_ch18"]', '{}', 'Keep schema-v2 heads readable during ordered-flow rollout', 'migration_0021', CURRENT_TIMESTAMP);
