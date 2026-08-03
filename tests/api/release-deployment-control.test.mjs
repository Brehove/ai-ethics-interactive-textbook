import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentReceiptHash, sha256 } from '../../workers/content-api/src/services.mjs';
import worker from '../../workers/content-api/src/index.mjs';

const workflowHeaders = (scopes = 'content:deployReceipt') => ({
  'content-type': 'application/json',
  'x-content-gateway-verified': 'v1',
  'x-content-actor-id': 'actor_release_workflow',
  'x-content-actor-type': 'service',
  'x-content-client-id': 'github-content-release',
  'x-content-run-id': 'run-release-17',
  'x-content-scopes': scopes
});

const makeDb = (resolve, batchHook) => {
  const statements = [];
  const batches = [];
  return {
    statements, batches,
    prepare(sql) {
      const statement = {
        sql, args: [],
        bind(...args) { this.args = args; return this; },
        async first() { return resolve(sql, this.args, 'first'); },
        async all() { return resolve(sql, this.args, 'all') || { results: [] }; }
      };
      statements.push(statement);
      return statement;
    },
    async batch(items) {
      batches.push(items);
      if (batchHook) await batchHook(items, batches.length);
      return items.map((item) => {
        const result = resolve(item.sql, item.args, 'batch');
        if (result) return result;
        if (item.sql.includes('INSERT INTO api_rate_limits')) return { results: [{ request_count: 1 }], meta: { changes: 1 } };
        return { meta: { changes: 1 } };
      });
    }
  };
};

const completeAuthorityEntries = () => Array.from({ length: 18 }, (_, index) => {
  const chapter = String(index + 1).padStart(2, '0');
  const d1 = chapter === '07';
  return {
    documentId: `chapter_ch${chapter}`,
    authority: d1 ? 'd1' : 'git',
    sourcePath: d1 ? null : `content/chapters/${chapter}-chapter-${chapter}/`,
    sourceRevision: d1 ? 'revision_ch07_release_17' : `${(index % 15).toString(16)}`.repeat(64),
    normalizedSnapshotHash: `${((index + 1) % 15).toString(16)}`.repeat(64)
  };
});

const stageBody = (overrides = {}) => ({
  candidateId: 'candidate_ch07_17',
  snapshotHash: 'a'.repeat(64),
  snapshotRevision: 'snapshotrev_ch07_17',
  candidateManifestHash: 'b'.repeat(64),
  buildAttestationHash: 'c'.repeat(64),
  expectedActiveReleaseId: null,
  cloudflareVersionId: 'version_cf_17',
  authorityEntries: completeAuthorityEntries(),
  idempotencyKey: 'stage-release-17',
  ...overrides
});

test('only the protected workflow service can stage deployments or receipts', async () => {
  const agentHeaders = { ...workflowHeaders(), 'x-content-actor-id': 'actor_agent_1', 'x-content-actor-type': 'agent' };
  let response = await worker.fetch(new Request('https://content.example/v1/release-deployments:stage', { method: 'POST', headers: agentHeaders, body: JSON.stringify(stageBody()) }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'RELEASE_WORKFLOW_REQUIRED');
  response = await worker.fetch(new Request('https://content.example/v1/release-deployments/deployment_1:recordReceipt', { method: 'POST', headers: agentHeaders, body: '{}' }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'RELEASE_WORKFLOW_REQUIRED');
});

test('staging fails closed when expected-active is stale', async () => {
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM submitted_snapshots s JOIN changesets')) return { id: 'snapshot-1', changeset_id: 'cs-1', snapshot_hash: 'a'.repeat(64), snapshot_revision: 'snapshotrev_ch07_17', state: 'approved' };
    if (sql.includes('FROM approvals')) return { id: 'approval-human-1' };
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_current' };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/release-deployments:stage', {
    method: 'POST', headers: workflowHeaders(), body: JSON.stringify(stageBody({ expectedActiveReleaseId: 'release_stale' }))
  }), { CONTENT_DB: db });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'ACTIVE_RELEASE_CONFLICT');
  assert.equal(db.statements.some((item) => item.sql.includes('UPDATE release_sequences SET')), false);
});

test('staging persists one exact approved candidate and replays idempotently', async () => {
  const body = stageBody();
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM submitted_snapshots s JOIN changesets')) return { id: 'snapshot-1', changeset_id: 'cs-1', snapshot_hash: body.snapshotHash, snapshot_revision: body.snapshotRevision, state: 'approved' };
    if (sql.includes('FROM approvals')) return { id: 'approval-human-1' };
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return null;
    if (sql.includes('UPDATE release_sequences SET')) return { sequence: 17 };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/release-deployments:stage', { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.sequence, 17);
  assert.equal(result.expectedActiveReleaseId, null);
  const finalBatch = db.batches.at(-1);
  assert.ok(finalBatch.some((item) => item.sql.includes('INSERT INTO releases')));
  assert.ok(finalBatch.some((item) => item.sql.includes('INSERT INTO release_deployment_transactions')));
  assert.equal(finalBatch.some((item) => item.sql.includes('release_pointers')), false, 'staging must not advance traffic state');

  const replay = JSON.stringify({ replayed: true });
  const requestHash = await sha256(body);
  const replayDb = makeDb((sql) => sql.includes('FROM idempotency_records') ? { request_hash: requestHash, response_status: 201, response_json: replay } : null);
  const replayResponse = await worker.fetch(new Request('https://content.example/v1/release-deployments:stage', { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: replayDb });
  assert.equal(replayResponse.status, 201);
  assert.equal(replayResponse.headers.get('idempotent-replay'), 'true');
  assert.deepEqual(await replayResponse.json(), { replayed: true });
});

const transaction = (overrides = {}) => ({
  id: 'deployment_17', action: 'promote', state: 'staged', release_id: 'release_17', candidate_id: 'candidate_ch07_17',
  snapshot_hash: 'a'.repeat(64), snapshot_revision: 'snapshotrev_ch07_17', candidate_manifest_hash: 'b'.repeat(64),
  build_attestation_hash: 'c'.repeat(64), expected_active_release_id: null, cloudflare_version_id: 'version_cf_17', expires_at: '2099-01-01T00:00:00.000Z',
  ...overrides
});

const receiptBody = async (tx = transaction(), overrides = {}) => {
  const base = {
    candidateManifestHash: tx.candidate_manifest_hash,
    buildAttestationHash: tx.build_attestation_hash,
    cloudflareDeploymentId: 'deployment_cf_17',
    cloudflareVersionId: tx.cloudflare_version_id,
    verificationHash: 'd'.repeat(64),
    idempotencyKey: 'receipt-release-17'
  };
  const value = { ...base, ...overrides };
  value.receiptHash ??= await deploymentReceiptHash({
    transactionId: tx.id, action: tx.action, releaseId: tx.release_id, previousActiveReleaseId: tx.expected_active_release_id,
    candidateId: tx.candidate_id, snapshotHash: tx.snapshot_hash, snapshotRevision: tx.snapshot_revision,
    candidateManifestHash: value.candidateManifestHash, buildAttestationHash: value.buildAttestationHash,
    cloudflareDeploymentId: value.cloudflareDeploymentId, cloudflareVersionId: value.cloudflareVersionId, verificationHash: value.verificationHash
  });
  return value;
};

test('receipt hash binds the exact staged manifest, attestation, version, and expected active release', async () => {
  const tx = transaction();
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM release_deployment_transactions')) return tx;
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return null;
    return null;
  });
  const body = await receiptBody(tx, { receiptHash: '0'.repeat(64) });
  const response = await worker.fetch(new Request(`https://content.example/v1/release-deployments/${tx.id}:recordReceipt`, { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'RECEIPT_HASH_MISMATCH');
  assert.equal(db.batches.some((batch) => batch.some((item) => item.sql.includes('INSERT INTO deployment_receipts'))), false);
});

test('recording a receipt advances active state only through the trigger-protected pointer command', async () => {
  const tx = transaction();
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM release_deployment_transactions')) return tx;
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return null;
    return null;
  });
  const body = await receiptBody(tx);
  const response = await worker.fetch(new Request(`https://content.example/v1/release-deployments/${tx.id}:recordReceipt`, { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.activeReleaseId, tx.release_id);
  const finalBatch = db.batches.at(-1);
  assert.ok(finalBatch.some((item) => item.sql.includes('INSERT INTO deployment_receipts')));
  assert.ok(finalBatch.some((item) => item.sql.includes('INSERT INTO release_pointer_commands')));
  assert.equal(finalBatch.some((item) => item.sql.includes('INSERT INTO release_pointers')), false, 'the endpoint cannot bypass trigger-enforced CAS');
});

test('a concurrent pointer race aborts receipt recording with a specific stale-active conflict', async () => {
  const tx = transaction({ expected_active_release_id: 'release_16' });
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM release_deployment_transactions')) return tx;
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_16' };
    return null;
  }, async (items) => {
    if (items.some((item) => item.sql.includes('INSERT INTO release_pointer_commands'))) throw new Error('RELEASE_POINTER_CAS_MISMATCH');
  });
  const body = await receiptBody(tx);
  const response = await worker.fetch(new Request(`https://content.example/v1/release-deployments/${tx.id}:recordReceipt`, { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'ACTIVE_RELEASE_CONFLICT');
});

test('rollback staging selects only a previously promoted immutable version and never advances the pointer', async () => {
  const target = { id: 'release_12', state: 'superseded', candidate_id: 'candidate_12', manifest_hash: 'e'.repeat(64), snapshot_hash: 'f'.repeat(64), snapshot_revision: 'snapshotrev_12', build_attestation_hash: '1'.repeat(64), cloudflare_version_id: 'version_cf_12' };
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM releases r')) return target;
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_17' };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/releases/release_12:stageRollback', { method: 'POST', headers: workflowHeaders(), body: JSON.stringify({ expectedActiveReleaseId: 'release_17', idempotencyKey: 'rollback-stage-12' }) }), { CONTENT_DB: db });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.action, 'rollback');
  assert.equal(result.cloudflareVersionId, 'version_cf_12');
  assert.equal(db.batches.at(-1).some((item) => item.sql.includes('release_pointers')), false);

  const deniedDb = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM releases r')) return null;
    return null;
  });
  const denied = await worker.fetch(new Request('https://content.example/v1/releases/release_unknown:stageRollback', { method: 'POST', headers: workflowHeaders(), body: JSON.stringify({ expectedActiveReleaseId: 'release_17', idempotencyKey: 'rollback-stage-x' }) }), { CONTENT_DB: deniedDb });
  assert.equal(denied.status, 409);
  assert.equal((await denied.json()).error.code, 'ROLLBACK_TARGET_INVALID');
});

test('missing and expired staged deployments fail closed without receipt writes', async () => {
  for (const tx of [null, transaction({ state: 'staged', expires_at: '2000-01-01T00:00:00.000Z' })]) {
    const db = makeDb((sql) => {
      if (sql.includes('FROM idempotency_records')) return null;
      if (sql.includes('FROM release_deployment_transactions')) return tx;
      return null;
    });
    const body = await receiptBody(transaction());
    const response = await worker.fetch(new Request('https://content.example/v1/release-deployments/deployment_17:recordReceipt', { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
    assert.equal(response.status, tx ? 409 : 404);
    assert.equal(db.batches.some((batch) => batch.some((item) => item.sql.includes('INSERT INTO deployment_receipts'))), false);
  }
});
