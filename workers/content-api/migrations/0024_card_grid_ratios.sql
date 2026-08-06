-- Advance the semantic layout catalog without rewriting immutable chapter revisions.
-- The first subsequent schema-v4 layout mutation migrates a 2026-08-05 chapter
-- document to 2026-08-06 in the new immutable working revision.
UPDATE runtime_feature_flags
SET config_json = '{"contentSchemaVersion":4,"layoutCatalogVersion":"2026-08-06","rendererVersion":"chapter-renderer-v4-card-ratios"}',
    version = version + 1,
    reason = 'Semantic unequal two-card ratios with container-aware person cards',
    updated_by = 'migration_0024',
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'card_layouts_v1';
