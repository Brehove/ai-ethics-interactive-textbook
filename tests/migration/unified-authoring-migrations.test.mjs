import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = (name) => readFile(new URL(`../../workers/content-api/migrations/${name}`, import.meta.url), "utf8");

test("public projection migration pins immutable projection and exact head", async () => {
  const sql = await migration("0017_public_chapter_projections.sql");
  assert.match(sql, /CREATE TABLE public_chapter_projections/);
  assert.match(sql, /CREATE TABLE public_chapter_heads/);
  assert.match(sql, /RAISE\(ABORT, 'public_head_projection_mismatch'\)/);
});

test("live commit migration aborts stale authority, head, and working version inside the batch", async () => {
  const sql = await migration("0018_atomic_live_commit_commands.sql");
  assert.match(sql, /CREATE TABLE live_commit_commands/);
  assert.match(sql, /UNIQUE \(actor_id, idempotency_key\)/);
  assert.match(sql, /expected_authority_id TEXT NOT NULL REFERENCES authority_registry/);
  assert.match(sql, /CREATE TABLE live_commit_delivery_status/);
  assert.match(sql, /state TEXT NOT NULL CHECK \(state IN \('confirmation_pending', 'verified'\)\)/);
  assert.match(sql, /status_expires_at TEXT NOT NULL/);
  assert.match(sql, /CREATE TRIGGER live_commit_exact_authority/);
  assert.match(sql, /a\.id = NEW\.expected_authority_id/);
  assert.match(sql, /RAISE\(ABORT, 'D1_AUTHORITY_REQUIRED'\)/);
  assert.match(sql, /CREATE TRIGGER live_commit_exact_preconditions/);
  assert.match(sql, /d\.current_revision_id = NEW\.expected_base_revision_id/);
  assert.match(sql, /w\.version = NEW\.expected_working_version/);
  assert.match(sql, /RAISE\(ABORT, 'REVISION_CONFLICT'\)/);
  assert.match(sql, /liveCommitCommandId/);
});

test("runtime flags are versioned, audited, and disabled by default", async () => {
  const sql = await migration("0019_runtime_feature_flags.sql");
  assert.match(sql, /CREATE TABLE runtime_feature_flags/);
  assert.match(sql, /CREATE TABLE runtime_feature_flag_history/);
  assert.match(sql, /'unified_editor', 0/);
});

test("public projection receives only a minimal audited runtime-flag mirror", async () => {
  const sql = await migration("0020_public_runtime_feature_flags.sql");
  assert.match(sql, /CREATE TABLE public_runtime_feature_flags/);
  assert.match(sql, /INSERT INTO public_runtime_feature_flags/);
  assert.match(sql, /DROP TRIGGER runtime_feature_flag_audit_insert/);
  assert.doesNotMatch(sql.split("CREATE TABLE public_runtime_feature_flags")[1].split(");")[0], /config_json|reason|changed_by/);
});
