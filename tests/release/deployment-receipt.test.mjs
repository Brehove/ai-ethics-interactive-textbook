import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { deploymentReceiptHash, deploymentReceiptPayload, stableStringify } from '../../workers/content-api/src/services.mjs';

const payload = Object.freeze({
  transactionId: 'deployment_17',
  action: 'promote',
  releaseId: 'release_17',
  previousActiveReleaseId: 'release_16',
  candidateId: 'candidate_ch07_17',
  snapshotHash: 'a'.repeat(64),
  snapshotRevision: 'snapshotrev_ch07_17',
  candidateManifestHash: 'b'.repeat(64),
  buildAttestationHash: 'c'.repeat(64),
  cloudflareDeploymentId: 'deployment_cf_17',
  cloudflareVersionId: 'version_cf_17',
  verificationHash: 'd'.repeat(64)
});

test('deployment receipt hashing is canonical and binds every promotion fact', async () => {
  const canonical = deploymentReceiptPayload(payload);
  assert.equal(canonical.schemaVersion, 1);
  assert.equal(await deploymentReceiptHash(payload), await deploymentReceiptHash({ ...payload }));
  assert.equal(await deploymentReceiptHash(payload), await deploymentReceiptHash(JSON.parse(stableStringify(payload))));

  for (const [field, replacement] of Object.entries({
    transactionId: 'deployment_18', action: 'rollback', releaseId: 'release_18', previousActiveReleaseId: null,
    candidateId: null, snapshotHash: 'e'.repeat(64), snapshotRevision: 'snapshotrev_ch07_18',
    candidateManifestHash: 'f'.repeat(64), buildAttestationHash: '1'.repeat(64),
    cloudflareDeploymentId: 'deployment_cf_18', cloudflareVersionId: 'version_cf_18', verificationHash: '2'.repeat(64)
  })) {
    assert.notEqual(await deploymentReceiptHash(payload), await deploymentReceiptHash({ ...payload, [field]: replacement }), `${field} must be hash-bound`);
  }
});

test('deployment receipt migration serializes active-pointer CAS and keeps history', async () => {
  const schema = await readFile(new URL('../../workers/content-api/migrations/0007_serialized_deployment_receipts.sql', import.meta.url), 'utf8');
  assert.match(schema, /CREATE TABLE release_deployment_transactions/);
  assert.match(schema, /CREATE UNIQUE INDEX release_deployment_one_staged_book[\s\S]+WHERE state = 'staged'/);
  assert.match(schema, /CREATE TABLE deployment_receipts/);
  assert.match(schema, /transaction_id TEXT NOT NULL UNIQUE/);
  assert.match(schema, /receipt_hash TEXT NOT NULL UNIQUE/);
  assert.match(schema, /CREATE TRIGGER release_pointer_commands_expected_active[\s\S]+BEFORE INSERT ON release_pointer_commands/);
  assert.match(schema, /RAISE\(ABORT, 'RELEASE_POINTER_CAS_MISMATCH'\)/);
  assert.match(schema, /CREATE TRIGGER release_pointer_commands_apply[\s\S]+INSERT INTO release_pointers[\s\S]+INSERT INTO release_pointer_history/);
});
