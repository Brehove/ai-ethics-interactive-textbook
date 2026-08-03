import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('backup workflow keeps a tested Cloudflare copy and encrypted off-provider disaster copy', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/content-snapshot-export.yml', import.meta.url), 'utf8');
  assert.match(workflow, /PRAGMA integrity_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  for (const bucket of ['ai-ethics-content-media', 'ai-ethics-snapshots', 'ai-ethics-release-artifacts']) assert.match(workflow, new RegExp(bucket));
  assert.match(workflow, /r2-SHA256SUMS/);
  assert.match(workflow, /test "\$total_bytes" -le 471859200/);
  assert.match(workflow, /age -r "\$BACKUP_AGE_RECIPIENT"/);
  assert.match(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);
  assert.match(workflow, /retention-days: 30/);
  assert.match(workflow, /BACKUP_SOURCE_R2_ACCESS_KEY_ID/);
  assert.match(workflow, /BACKUP_SOURCE_R2_SECRET_ACCESS_KEY/);
  assert.match(workflow, /BACKUP_DEST_R2_ACCESS_KEY_ID/);
  assert.match(workflow, /BACKUP_DEST_R2_SECRET_ACCESS_KEY/);
  assert.doesNotMatch(workflow, /secrets\.BACKUP_R2_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/);
  assert.doesNotMatch(workflow, /AGE_SECRET|AGE_IDENTITY|age-secret-key/);
});
