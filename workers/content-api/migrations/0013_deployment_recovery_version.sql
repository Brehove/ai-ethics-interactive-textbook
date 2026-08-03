PRAGMA foreign_keys = ON;

-- Preserve the exact pre-promotion Worker version inside D1 so a later
-- scheduled reconciler can distinguish "traffic moved" from "traffic never
-- moved" even when the original GitHub runner and its artifacts disappeared.
ALTER TABLE release_deployment_transactions ADD COLUMN previous_cloudflare_version_id TEXT;
