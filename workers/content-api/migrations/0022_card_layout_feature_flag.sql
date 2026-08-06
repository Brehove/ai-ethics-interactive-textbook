-- Schema-v4 layout writes begin with the existing Chapter 7 canary.
-- Layout data stays in immutable chapter revision JSON; no second layout table exists.
INSERT INTO runtime_feature_flags (name, enabled, document_ids_json, config_json, reason, updated_by, updated_at)
VALUES (
  'card_layouts_v1',
  0,
  '["chapter_ch07"]',
  '{"contentSchemaVersion":4,"layoutCatalogVersion":"2026-08-05","rendererVersion":"chapter-renderer-v3-layouts"}',
  'Disabled schema-v4 flexible card-layout canary',
  'migration_0022',
  CURRENT_TIMESTAMP
)
ON CONFLICT(name) DO NOTHING;
