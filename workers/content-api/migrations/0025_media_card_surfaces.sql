-- Advance the layout catalog for semantic media surfaces without rewriting
-- immutable chapter revisions. An existing schema-v4 document advances on its
-- next layout mutation in the new immutable working revision.
UPDATE runtime_feature_flags
SET config_json = '{"contentSchemaVersion":4,"layoutCatalogVersion":"2026-08-06.1","rendererVersion":"chapter-renderer-v4-media-surfaces"}',
    version = version + 1,
    reason = 'Semantic plain and panel surfaces for bounded contextual media figures',
    updated_by = 'migration_0025',
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'card_layouts_v1';
