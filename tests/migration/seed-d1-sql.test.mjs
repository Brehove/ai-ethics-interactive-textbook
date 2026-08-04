import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('D1 seed SQL keeps every statement below the remote import limit and makes chunk retries idempotent', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ai-ethics-seed-'));
  const output = path.join(directory, 'seed.sql');
  try {
    const tsx = path.join(repositoryRoot, 'node_modules', '.bin', 'tsx');
    const { stdout } = await execFileAsync(tsx, ['scripts/content/seed-d1.mts', output], { cwd: repositoryRoot });
    const report = JSON.parse(stdout);
    assert.equal(report.chapters, 18);

    const sql = await readFile(output, 'utf8');
    const lines = sql.trimEnd().split('\n');
    assert.ok(Math.max(...lines.map((line) => Buffer.byteLength(line, 'utf8'))) < 64 * 1024);
    assert.equal(lines.filter((line) => line.startsWith('INSERT OR IGNORE INTO document_revisions')).length, 18);
    assert.equal(lines.filter((line) => line.startsWith('UPDATE authority_registry SET active = 0')).length, 18);
    assert.equal(lines.filter((line) => line.startsWith("UPDATE authority_registry SET authority = 'git'")).length, 18);
    assert.equal(lines.filter((line) => line.startsWith('INSERT OR IGNORE INTO authority_registry')).length, 18);
    assert.match(sql, /authority = 'git'/);
    assert.match(sql, /source_revision = '[^']+' AND NOT EXISTS \(SELECT 1 FROM authority_registry active_authority/);
    assert.match(sql, /WHERE NOT EXISTS \(SELECT 1 FROM authority_registry/);
    assert.ok(lines.filter((line) => line.startsWith('UPDATE document_revisions SET content_text = content_text ||')).length > 18);
    for (const line of lines.filter((line) => line.startsWith('UPDATE document_revisions SET content_text = content_text ||'))) {
      assert.match(line, /AND length\(content_text\) = \d+;$/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
