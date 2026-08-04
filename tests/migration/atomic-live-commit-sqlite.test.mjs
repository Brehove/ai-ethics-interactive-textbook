import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const migrationSql = () => readFile(new URL('../../workers/content-api/migrations/0018_atomic_live_commit_commands.sql', import.meta.url), 'utf8');
const hash = (letter) => letter.repeat(64);

const setup = async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE documents (id TEXT PRIMARY KEY, state TEXT NOT NULL, current_revision_id TEXT, current_content_hash TEXT);
    CREATE TABLE document_revisions (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, parent_revision_id TEXT, content_hash TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE authority_registry (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, authority TEXT NOT NULL, active INTEGER NOT NULL, source_revision TEXT NOT NULL, normalized_snapshot_hash TEXT NOT NULL);
    CREATE TABLE changesets (id TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE working_documents (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, changeset_id TEXT NOT NULL, base_revision_id TEXT NOT NULL, version INTEGER NOT NULL);
  `);
  db.exec(await migrationSql());
  db.prepare(`INSERT INTO document_revisions (id, document_id, content_hash) VALUES (?, ?, ?)`).run('revision_base', 'chapter_ch07', hash('a'));
  db.prepare(`INSERT INTO documents VALUES (?, 'active', ?, ?)`).run('chapter_ch07', 'revision_base', hash('a'));
  db.prepare(`INSERT INTO authority_registry VALUES (?, ?, 'd1', 1, ?, ?)`).run('authority_exact', 'chapter_ch07', 'revision_base', hash('a'));
  db.prepare(`INSERT INTO changesets VALUES ('changeset_1', 'open')`).run();
  db.prepare(`INSERT INTO working_documents VALUES ('working_1', 'chapter_ch07', 'changeset_1', 'revision_base', 2)`).run();
  return db;
};

const insertCommand = (db, { id, authorityId = 'authority_exact', revision = 'revision_base', version = 2 }) => db.prepare(`
  INSERT INTO live_commit_commands (id, idempotency_key, request_hash, document_id, changeset_id, working_document_id,
    expected_authority_id, expected_base_revision_id, expected_working_version, state, public_url, actor_id, actor_type, created_at)
  VALUES (?, ?, ?, 'chapter_ch07', 'changeset_1', 'working_1', ?, ?, ?, 'committing', 'https://reader.example/chapter/example/', 'actor_editor_1', 'human', '2026-08-03T00:00:00Z')
`).run(id, `key-${id}`, hash('b'), authorityId, revision, version);

test('SQLite execution proves the guarded first command lets only one stale concurrent commit advance the head', async () => {
  const db = await setup();
  try {
    db.exec('BEGIN');
    insertCommand(db, { id: 'commit_winner' });
    db.prepare(`INSERT INTO document_revisions (id, document_id, parent_revision_id, content_hash, metadata_json) VALUES ('revision_winner', 'chapter_ch07', 'revision_base', ?, ?)`)
      .run(hash('c'), JSON.stringify({ publicationMode: 'instructor-live-save', liveCommitCommandId: 'commit_winner' }));
    db.prepare(`UPDATE documents SET current_revision_id = 'revision_winner', current_content_hash = ? WHERE id = 'chapter_ch07'`).run(hash('c'));
    db.prepare(`UPDATE authority_registry SET source_revision = 'revision_winner', normalized_snapshot_hash = ? WHERE id = 'authority_exact'`).run(hash('c'));
    db.exec('COMMIT');
    assert.throws(() => insertCommand(db, { id: 'commit_loser' }), /REVISION_CONFLICT/);
    assert.equal(db.prepare(`SELECT count(*) AS count FROM live_commit_commands`).get().count, 1);
    assert.equal(db.prepare(`SELECT current_revision_id AS id FROM documents WHERE id = 'chapter_ch07'`).get().id, 'revision_winner');
  } finally { db.close(); }
});

test('SQLite execution aborts a commit when the exact authority row changes after preflight', async () => {
  const db = await setup();
  try {
    db.prepare(`UPDATE authority_registry SET active = 0 WHERE id = 'authority_exact'`).run();
    db.prepare(`INSERT INTO authority_registry VALUES ('authority_replaced', 'chapter_ch07', 'd1', 1, 'revision_base', ?)`).run(hash('a'));
    assert.throws(() => insertCommand(db, { id: 'commit_stale_authority' }), /D1_AUTHORITY_REQUIRED/);
    assert.equal(db.prepare(`SELECT count(*) AS count FROM live_commit_commands`).get().count, 0);
  } finally { db.close(); }
});
