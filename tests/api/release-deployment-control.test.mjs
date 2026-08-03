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
  previousCloudflareVersionId: 'version_cf_legacy',
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

test('code-only staging may reuse only the exact human-approved snapshot of the expected active release', async () => {
  const body = stageBody({
    expectedActiveReleaseId: 'release_current',
    previousCloudflareVersionId: 'version_cf_current',
    cloudflareVersionId: 'version_cf_code_fix',
    idempotencyKey: 'stage-code-only-fix'
  });
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM submitted_snapshots s JOIN changesets')) return { id: 'snapshot-1', changeset_id: 'cs-1', snapshot_hash: body.snapshotHash, snapshot_revision: body.snapshotRevision, state: 'applied' };
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_current' };
    if (sql.includes('FROM releases WHERE id = ?')) return { id: 'release_current', changeset_id: 'cs-1', state: 'published', snapshot_hash: body.snapshotHash, snapshot_revision: body.snapshotRevision, cloudflare_version_id: 'version_cf_current' };
    if (sql.includes('FROM approvals')) return { id: 'approval-human-1' };
    if (sql.includes('UPDATE release_sequences SET')) return { sequence: 18 };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/release-deployments:stage', { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
  assert.equal(response.status, 201);
  assert.equal(db.statements.some((item) => item.sql.includes('FROM working_documents')), false, 'later instructor live saves must not stale an otherwise exact code-only release');
  const auditStatement = db.batches.at(-1).find((item) => item.sql.includes('INSERT INTO audit_events'));
  assert.match(auditStatement.args.find((item) => typeof item === 'string' && item.includes('reusesActiveSnapshot')), /"reusesActiveSnapshot":true/);
});

test('code-only staging rejects an applied snapshot that is not the exact active release snapshot', async () => {
  const body = stageBody({ expectedActiveReleaseId: 'release_current', previousCloudflareVersionId: 'version_cf_current' });
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM submitted_snapshots s JOIN changesets')) return { id: 'snapshot-1', changeset_id: 'cs-1', snapshot_hash: body.snapshotHash, snapshot_revision: body.snapshotRevision, state: 'applied' };
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_current' };
    if (sql.includes('FROM releases WHERE id = ?')) return { id: 'release_current', changeset_id: 'cs-other', state: 'published', snapshot_hash: 'f'.repeat(64), snapshot_revision: 'snapshotrev_other', cloudflare_version_id: 'version_cf_current' };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/release-deployments:stage', { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'CHANGESET_NOT_APPROVED');
  assert.equal(db.statements.some((item) => item.sql.includes('FROM approvals')), false);
});

test('a retried candidate receives a distinct release identity for each immutable Worker version', async () => {
  const responses = [];
  for (const cloudflareVersionId of ['version_cf_retry_1', 'version_cf_retry_2']) {
    const body = stageBody({ cloudflareVersionId, idempotencyKey: `stage-${cloudflareVersionId}` });
    const db = makeDb((sql) => {
      if (sql.includes('FROM idempotency_records')) return null;
      if (sql.includes('FROM submitted_snapshots s JOIN changesets')) return { id: 'snapshot-1', changeset_id: 'cs-1', snapshot_hash: body.snapshotHash, snapshot_revision: body.snapshotRevision, state: 'approved' };
      if (sql.includes('FROM approvals')) return { id: 'approval-human-1' };
      if (sql.includes("FROM release_pointers WHERE name = 'active'")) return null;
      if (sql.includes('UPDATE release_sequences SET')) return { sequence: responses.length + 20 };
      return null;
    });
    const response = await worker.fetch(new Request('https://content.example/v1/release-deployments:stage', { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
    assert.equal(response.status, 201);
    responses.push(await response.json());
  }
  assert.notEqual(responses[0].releaseId, responses[1].releaseId);
  assert.notEqual(responses[0].transactionId, responses[1].transactionId);
});

const transaction = (overrides = {}) => ({
  id: 'deployment_17', action: 'promote', state: 'staged', release_id: 'release_17', candidate_id: 'candidate_ch07_17',
  snapshot_hash: 'a'.repeat(64), snapshot_revision: 'snapshotrev_ch07_17', candidate_manifest_hash: 'b'.repeat(64),
  build_attestation_hash: 'c'.repeat(64), expected_active_release_id: null, cloudflare_version_id: 'version_cf_17', expires_at: '2099-01-01T00:00:00.000Z',
  previous_cloudflare_version_id: 'version_cf_legacy',
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
    if (sql.includes('SELECT cloudflare_version_id FROM releases')) return { cloudflare_version_id: 'version_cf_17' };
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/releases/release_12:stageRollback', { method: 'POST', headers: workflowHeaders(), body: JSON.stringify({ expectedActiveReleaseId: 'release_17', idempotencyKey: 'rollback-stage-12' }) }), { CONTENT_DB: db });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.action, 'rollback');
  assert.equal(result.cloudflareVersionId, 'version_cf_12');
  assert.equal(result.previousCloudflareVersionId, 'version_cf_17');
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

test('rollback receipt atomically restores the complete authority map and every D1 canonical head', async () => {
  const tx = transaction({ id: 'deployment_rollback_12', action: 'rollback', release_id: 'release_12', candidate_id: null, snapshot_hash: null, snapshot_revision: null, expected_active_release_id: 'release_17', cloudflare_version_id: 'version_cf_12' });
  const entries = completeAuthorityEntries().map((entry) => entry.documentId === 'chapter_ch07'
    ? { document_id: entry.documentId, authority: 'd1', source_path: null, source_revision: 'revision_ch07_release_12', normalized_snapshot_hash: '7'.repeat(64) }
    : { document_id: entry.documentId, authority: 'git', source_path: entry.sourcePath, source_revision: entry.sourceRevision, normalized_snapshot_hash: entry.normalizedSnapshotHash });
  const db = makeDb((sql, args, mode) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM release_deployment_transactions')) return tx;
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_17' };
    if (sql.includes('FROM release_authority_entries')) return mode === 'all' ? { results: entries } : null;
    if (sql.includes('FROM document_revisions WHERE id')) return { document_id: 'chapter_ch07', content_hash: '7'.repeat(64) };
    return null;
  });
  const body = await receiptBody(tx);
  const response = await worker.fetch(new Request(`https://content.example/v1/release-deployments/${tx.id}:recordReceipt`, { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
  const text = await response.text(); assert.equal(response.status, 201, text);
  const finalBatch = db.batches.at(-1);
  assert.equal(finalBatch.filter((item) => item.sql.includes('INSERT INTO authority_registry')).length, 18);
  assert.equal(finalBatch.filter((item) => item.sql.includes('UPDATE documents SET current_revision_id')).length, 1);
  const publishedIndex = finalBatch.findIndex((item) => item.sql.includes("UPDATE releases SET state = 'published'"));
  const pointerIndex = finalBatch.findIndex((item) => item.sql.includes('INSERT INTO release_pointer_commands'));
  const authorityIndex = finalBatch.findIndex((item) => item.sql.includes('INSERT INTO authority_registry'));
  assert.ok(publishedIndex >= 0 && publishedIndex < pointerIndex && pointerIndex < authorityIndex, 'target release and pointer must become active before the D1 authority trigger runs in the same batch');
});

test('rollback receipt fails closed before pointer mutation when target authority history is incomplete', async () => {
  const tx = transaction({ id: 'deployment_rollback_bad', action: 'rollback', release_id: 'release_bad', candidate_id: null, snapshot_hash: null, snapshot_revision: null, expected_active_release_id: 'release_17' });
  const db = makeDb((sql, _args, mode) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM release_deployment_transactions')) return tx;
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_17' };
    if (sql.includes('FROM release_authority_entries')) return mode === 'all' ? { results: completeAuthorityEntries().slice(0, 17) } : null;
    return null;
  });
  const response = await worker.fetch(new Request(`https://content.example/v1/release-deployments/${tx.id}:recordReceipt`, { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(await receiptBody(tx)) }), { CONTENT_DB: db });
  assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'ROLLBACK_AUTHORITY_INCOMPLETE');
  assert.equal(db.batches.some((batch) => batch.some((item) => item.sql.includes('INSERT INTO release_pointer_commands'))), false);
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

test('pending recovery reports an expired staged transaction without abandoning it', async () => {
  const tx = transaction({ expires_at: '2000-01-01T00:00:00.000Z' });
  const entries = completeAuthorityEntries().map((entry) => ({ document_id: entry.documentId, authority: entry.authority, source_revision: entry.sourceRevision, normalized_snapshot_hash: entry.normalizedSnapshotHash }));
  const db = makeDb((sql, _args, mode) => {
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return null;
    if (sql.includes("FROM release_deployment_transactions\n    WHERE state = 'staged'")) return tx;
    if (sql.includes('FROM release_authority_entries WHERE release_id')) return mode === 'all' ? { results: entries } : null;
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/release-deployments:pending', { method: 'POST', headers: workflowHeaders(), body: '{}' }), { CONTENT_DB: db });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.pending.transactionId, tx.id);
  assert.equal(result.pending.expired, true);
  assert.equal(result.pending.authorityDocumentCount, 18);
  assert.equal(result.pending.d1Documents.length, 1);
  assert.equal(db.batches.length, 0, 'recovery discovery is read-only and must preserve the staged transaction');
});

test('recovery discovery returns the exact active authority map when no transaction is staged', async () => {
  const entries = completeAuthorityEntries().map((entry) => ({ document_id: entry.documentId, authority: entry.authority, source_revision: entry.sourceRevision, normalized_snapshot_hash: entry.normalizedSnapshotHash }));
  const db = makeDb((sql, _args, mode) => {
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_17' };
    if (sql.includes("FROM release_deployment_transactions\n    WHERE state = 'staged'")) return null;
    if (sql.includes('FROM release_authority_entries WHERE release_id')) return mode === 'all' ? { results: entries } : null;
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/release-deployments:pending', { method: 'POST', headers: workflowHeaders(), body: '{}' }), { CONTENT_DB: db });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.pending, null);
  assert.equal(result.activeRelease.releaseId, 'release_17');
  assert.equal(result.activeRelease.authorityDocumentCount, 18);
  assert.equal(result.activeRelease.d1Documents[0].documentId, 'chapter_ch07');
});

test('reconcile receipt completes an expired staged transaction after exact live-version verification', async () => {
  const tx = transaction({ expires_at: '2000-01-01T00:00:00.000Z' });
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM release_deployment_transactions')) return tx;
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return null;
    return null;
  });
  const body = await receiptBody(tx, { idempotencyKey: 'reconcile-expired-17' });
  const response = await worker.fetch(new Request(`https://content.example/v1/release-deployments/${tx.id}:reconcileReceipt`, { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.reconciled, true);
  assert.ok(db.batches.at(-1).some((item) => item.sql.includes('INSERT INTO deployment_receipts')));
});

test('abandon closes a staged transaction only when traffic remains on the exact recovery version', async () => {
  const tx = transaction({ expected_active_release_id: 'release_16', previous_cloudflare_version_id: 'version_cf_16' });
  const db = makeDb((sql) => {
    if (sql.includes('FROM idempotency_records')) return null;
    if (sql.includes('FROM release_deployment_transactions')) return tx;
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_16' };
    return null;
  });
  const body = { observedCloudflareVersionId: 'version_cf_16', verificationHash: '9'.repeat(64), idempotencyKey: 'abandon-release-17' };
  const response = await worker.fetch(new Request(`https://content.example/v1/release-deployments/${tx.id}:abandon`, { method: 'POST', headers: workflowHeaders(), body: JSON.stringify(body) }), { CONTENT_DB: db });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).state, 'abandoned');
  const finalBatch = db.batches.at(-1);
  assert.ok(finalBatch.some((item) => item.sql.includes("SET state = 'abandoned'")));
  assert.equal(finalBatch.some((item) => item.sql.includes('release_pointer_commands')), false);

  const denied = await worker.fetch(new Request(`https://content.example/v1/release-deployments/${tx.id}:abandon`, { method: 'POST', headers: workflowHeaders(), body: JSON.stringify({ ...body, observedCloudflareVersionId: tx.cloudflare_version_id, idempotencyKey: 'abandon-target-17' }) }), { CONTENT_DB: db });
  assert.equal(denied.status, 409);
  assert.equal((await denied.json()).error.code, 'DEPLOYMENT_LIVE_VERSION_AMBIGUOUS');
});

test('release-state audit verifies the full active authority map and D1 canonical heads', async () => {
  const expected = completeAuthorityEntries().map((entry) => ({
    document_id: entry.documentId, authority: entry.authority, source_path: entry.sourcePath,
    source_revision: entry.sourceRevision, normalized_snapshot_hash: entry.normalizedSnapshotHash
  }));
  const active = expected.map((entry) => ({ ...entry,
    current_revision_id: entry.authority === 'd1' ? entry.source_revision : `head_${entry.document_id}`,
    current_content_hash: entry.authority === 'd1' ? entry.normalized_snapshot_hash : null
  }));
  const db = makeDb((sql, _args, mode) => {
    if (sql.includes('SELECT id, state, cloudflare_version_id FROM releases')) return { id: 'release_17', state: 'published', cloudflare_version_id: 'version_cf_17' };
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_17' };
    if (sql.includes('FROM release_authority_entries WHERE release_id')) return mode === 'all' ? { results: expected } : null;
    if (sql.includes('FROM authority_registry a JOIN documents d')) return mode === 'all' ? { results: active } : null;
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/releases/release_17:auditState', { method: 'POST', headers: workflowHeaders('content:authority'), body: '{}' }), { CONTENT_DB: db });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.valid, true);
  assert.equal(result.documentCount, 18);
  assert.equal(result.expectedCloudflareVersionId, 'version_cf_17');
});

test('release-state audit accepts canonical Git file and commit provenance when the normalized hash matches', async () => {
  const expected = completeAuthorityEntries().map((entry) => ({
    document_id: entry.documentId, authority: entry.authority, source_path: entry.sourcePath,
    source_revision: entry.sourceRevision, normalized_snapshot_hash: entry.normalizedSnapshotHash
  }));
  const active = expected.map((entry) => ({
    ...entry,
    source_path: entry.authority === 'git' ? `${entry.source_path}chapter.md` : entry.source_path,
    source_revision: entry.authority === 'git' ? '0a2716182953f492a654aa8b704d420216f39450' : entry.source_revision,
    current_revision_id: entry.source_revision,
    current_content_hash: entry.normalized_snapshot_hash
  }));
  const db = makeDb((sql, _args, mode) => {
    if (sql.includes('SELECT id, state, cloudflare_version_id FROM releases')) return { id: 'release_17', state: 'published', cloudflare_version_id: 'version_cf_17' };
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_17' };
    if (sql.includes('FROM release_authority_entries WHERE release_id')) return mode === 'all' ? { results: expected } : null;
    if (sql.includes('FROM authority_registry a JOIN documents d')) return mode === 'all' ? { results: active } : null;
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/releases/release_17:auditState', { method: 'POST', headers: workflowHeaders('content:authority'), body: '{}' }), { CONTENT_DB: db });
  assert.equal(response.status, 200, await response.text());
});

test('release-state audit accepts only a continuous published instructor-live-save chain beyond the code release', async () => {
  const expected = completeAuthorityEntries().map((entry) => ({
    document_id: entry.documentId, authority: entry.authority, source_path: entry.sourcePath,
    source_revision: entry.sourceRevision, normalized_snapshot_hash: entry.normalizedSnapshotHash
  }));
  const active = expected.map((entry) => ({ ...entry, current_revision_id: entry.source_revision, current_content_hash: entry.normalized_snapshot_hash }));
  const chapter = active.find((entry) => entry.document_id === 'chapter_ch07');
  chapter.current_revision_id = 'revision_live_2'; chapter.current_content_hash = 'live-hash-2';
  const lineage = [
    { id: 'revision_live_2', parent_revision_id: 'revision_live_1', content_hash: 'live-hash-2', metadata_json: JSON.stringify({ status: 'published', publicationMode: 'instructor-live-save' }), depth: 0 },
    { id: 'revision_live_1', parent_revision_id: expected.find((entry) => entry.document_id === 'chapter_ch07').source_revision, content_hash: 'live-hash-1', metadata_json: JSON.stringify({ status: 'published', publicationMode: 'instructor-live-save' }), depth: 1 },
    { id: expected.find((entry) => entry.document_id === 'chapter_ch07').source_revision, parent_revision_id: null, content_hash: expected.find((entry) => entry.document_id === 'chapter_ch07').normalized_snapshot_hash, metadata_json: '{}', depth: 2 },
  ];
  let trustedLineage = true;
  const db = makeDb((sql, _args, mode) => {
    if (sql.includes('SELECT id, state, cloudflare_version_id FROM releases')) return { id: 'release_17', state: 'published', cloudflare_version_id: 'version_cf_17' };
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_17' };
    if (sql.includes('FROM release_authority_entries WHERE release_id')) return mode === 'all' ? { results: expected } : null;
    if (sql.includes('FROM authority_registry a JOIN documents d')) return mode === 'all' ? { results: active } : null;
    if (sql.includes('WITH RECURSIVE lineage')) return mode === 'all' ? { results: trustedLineage ? lineage : lineage.map((row, index) => index === 0 ? { ...row, metadata_json: JSON.stringify({ status: 'published', publicationMode: 'unknown' }) } : row) } : null;
    return null;
  });
  let response = await worker.fetch(new Request('https://content.example/v1/releases/release_17:auditState', { method: 'POST', headers: workflowHeaders('content:authority'), body: '{}' }), { CONTENT_DB: db });
  let result = await response.json(); assert.equal(response.status, 200); assert.equal(result.liveAdvances[0].documentId, 'chapter_ch07'); assert.equal(result.liveAdvances[0].revisionCount, 2);
  trustedLineage = false;
  response = await worker.fetch(new Request('https://content.example/v1/releases/release_17:auditState', { method: 'POST', headers: workflowHeaders('content:authority'), body: '{}' }), { CONTENT_DB: db });
  result = await response.json(); assert.equal(response.status, 409); assert.equal(result.error.code, 'RELEASE_STATE_MISMATCH');
});

test('release-state audit reports pointer, authority, and canonical-head drift without content', async () => {
  const expected = completeAuthorityEntries().map((entry) => ({
    document_id: entry.documentId, authority: entry.authority, source_path: entry.sourcePath,
    source_revision: entry.sourceRevision, normalized_snapshot_hash: entry.normalizedSnapshotHash
  }));
  const active = expected.map((entry) => ({ ...entry, current_revision_id: entry.source_revision, current_content_hash: entry.normalized_snapshot_hash }));
  active.find((entry) => entry.document_id === 'chapter_ch07').current_revision_id = 'revision_drifted';
  const db = makeDb((sql, _args, mode) => {
    if (sql.includes('SELECT id, state, cloudflare_version_id FROM releases')) return { id: 'release_17', state: 'published', cloudflare_version_id: 'version_cf_17' };
    if (sql.includes("FROM release_pointers WHERE name = 'active'")) return { release_id: 'release_16' };
    if (sql.includes('FROM release_authority_entries WHERE release_id')) return mode === 'all' ? { results: expected } : null;
    if (sql.includes('FROM authority_registry a JOIN documents d')) return mode === 'all' ? { results: active } : null;
    return null;
  });
  const response = await worker.fetch(new Request('https://content.example/v1/releases/release_17:auditState', { method: 'POST', headers: workflowHeaders('content:authority'), body: '{}' }), { CONTENT_DB: db });
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(result.error.code, 'RELEASE_STATE_MISMATCH');
  assert.ok(result.error.details.mismatches.some((item) => item.kind === 'active_pointer'));
  assert.ok(result.error.details.mismatches.some((item) => item.kind === 'canonical_revision' && item.documentId === 'chapter_ch07'));
  assert.equal(JSON.stringify(result).includes('content_text'), false);
});
