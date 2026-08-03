import {
  ApiError, ConflictError, MEDIA_UPLOAD_POLICY, OPERATION_PAYLOAD_SCHEMAS, PROVIDER_REGISTRY, applySemanticOperation, assertMediaBudget, deterministicId, readJsonBody,
  deploymentReceiptHash, finalizeChapterRevision, hmacSha256, requireScope, resolveIdempotency, resolveProviderUrl, semanticDiffChapter, sha256, sha256Bytes, stableStringify, trustedIdentity,
  validateChapter, validateMediaReviewPackage, validatePrivateOriginal, validateUploadRequest, verifyHmacSignature
} from './services.mjs';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
const errorJson = (status, code, message, details) => json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status);
const now = () => new Date().toISOString();
const validId = (value, label = 'id') => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value)) throw new ApiError(400, 'INVALID_ID', `${label} is invalid`);
  return value;
};
const parseStoredJson = (value, label) => {
  try { return JSON.parse(value); } catch { throw new ApiError(500, 'CORRUPT_CONTENT', `${label} contains invalid canonical JSON`); }
};
const runIdentity = (identity) => {
  if (!identity.runId || identity.runId.length > 200) throw new ApiError(401, 'UNAUTHENTICATED', 'Gateway run identity is required for mutations');
};
const requireHumanIdentity = (identity, action) => {
  if (identity.actorType !== 'human') throw new ApiError(403, 'HUMAN_ACTOR_REQUIRED', `${action} requires an authenticated human actor`);
};
const requireLiveSaveIdentity = (identity) => {
  if (identity.actorType === 'human') return;
  if (identity.actorType === 'agent' && identity.scopes.has('content:live-save')) return;
  throw new ApiError(403, 'LIVE_SAVE_AUTHORITY_REQUIRED', 'Live chapter save requires an authenticated human or an agent capability with content:live-save');
};
const requireReleaseWorkflowIdentity = (identity) => {
  requireScope(identity, 'content:deployReceipt'); runIdentity(identity);
  if (identity.actorType !== 'service' || identity.actorId !== 'actor_release_workflow' || identity.clientId !== 'github-content-release') {
    throw new ApiError(403, 'RELEASE_WORKFLOW_REQUIRED', 'Only the protected release workflow service may stage or record deployments');
  }
};
const requireAuthorityWorkflowIdentity = (identity) => {
  requireScope(identity, 'content:authority'); runIdentity(identity);
  if (identity.actorType !== 'service' || identity.actorId !== 'actor_release_workflow' || identity.clientId !== 'github-content-release') {
    throw new ApiError(403, 'RELEASE_WORKFLOW_REQUIRED', 'Only the protected release workflow service may change content authority');
  }
};
const exactHash = (value, label) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new ApiError(422, 'HASH_INVALID', `${label} must be exact lowercase SHA-256`);
  return value;
};
const optionalReleaseId = (value, label = 'expectedActiveReleaseId') => {
  if (value === null) return null;
  return validId(value, label);
};
const randomHex = (bytes = 32) => {
  const value = new Uint8Array(bytes); crypto.getRandomValues(value);
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
const requireMediaBindings = (env, names) => {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new ApiError(503, 'MEDIA_BINDING_UNAVAILABLE', 'Required private media bindings are unavailable', { missing });
};
const RATE_LIMITS = Object.freeze({ mutation: 120, upload: 20 });
const RATE_WINDOW_SECONDS = 60;
const pageParams = (url, { defaultLimit = 25, maxLimit = 100, maxCursor = 10000 } = {}) => {
  const rawLimit = url.searchParams.get('limit');
  const rawCursor = url.searchParams.get('cursor');
  if (rawLimit !== null && !/^\d+$/.test(rawLimit)) throw new ApiError(400, 'PAGINATION_INVALID', 'limit must be a positive integer');
  if (rawCursor !== null && !/^\d+$/.test(rawCursor)) throw new ApiError(400, 'PAGINATION_INVALID', 'cursor must be a non-negative integer');
  const limit = rawLimit === null ? defaultLimit : Number(rawLimit);
  const cursor = rawCursor === null ? 0 : Number(rawCursor);
  if (limit < 1 || limit > maxLimit || cursor > maxCursor) throw new ApiError(400, 'PAGINATION_INVALID', `limit must be 1-${maxLimit} and cursor must be at most ${maxCursor}`);
  return { limit, cursor };
};
const boundedQuery = (value, name, max = 100) => {
  if (value === null) return null;
  if (value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new ApiError(400, 'QUERY_INVALID', `${name} is invalid or exceeds ${max} characters`);
  return value.trim();
};

async function enforceRateLimit(env, identity, routeClass) {
  const limit = RATE_LIMITS[routeClass];
  if (!limit || !env.CONTENT_DB) throw new ApiError(503, 'RATE_LIMIT_STORE_UNAVAILABLE', 'Persistent rate-limit storage is unavailable');
  const epochSeconds = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(epochSeconds / RATE_WINDOW_SECONDS) * RATE_WINDOW_SECONDS;
  const subjectHash = await sha256({ actorId: identity.actorId, clientId: identity.clientId });
  const updatedAt = now();
  try {
    const results = await env.CONTENT_DB.batch([
      env.CONTENT_DB.prepare(`INSERT INTO api_rate_limits (subject_hash, route_class, window_start, request_count, updated_at)
        VALUES (?, ?, ?, 1, ?) ON CONFLICT(subject_hash, route_class, window_start) DO UPDATE SET
        request_count = api_rate_limits.request_count + 1, updated_at = excluded.updated_at
        WHERE api_rate_limits.request_count < ? RETURNING request_count`).bind(subjectHash, routeClass, windowStart, updatedAt, limit),
      env.CONTENT_DB.prepare('DELETE FROM api_rate_limits WHERE window_start < ?').bind(windowStart - 86400)
    ]);
    if (!Array.isArray(results?.[0]?.results)) throw new Error('Rate-limit store returned an invalid result');
    const counter = results[0].results[0];
    if (!counter) throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Mutation rate limit exceeded', { routeClass, limit, windowSeconds: RATE_WINDOW_SECONDS, retryAfterSeconds: Math.max(1, windowStart + RATE_WINDOW_SECONDS - epochSeconds) });
    return counter.request_count;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'RATE_LIMIT_STORE_UNAVAILABLE', 'Persistent rate-limit storage failed closed');
  }
}

async function audit(env, identity, action, entityType, entityId, details = {}, lineage = {}) {
  const createdAt = now();
  return env.CONTENT_DB.prepare(`INSERT INTO audit_events
    (id, actor_id, actor_type, action, entity_type, entity_id, request_id, client_id, run_id, base_revision_id, result_revision_id, idempotency_hash, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(await deterministicId('audit', { action, entityId, createdAt, runId: identity.runId }), identity.actorId, identity.actorType || 'service', action, entityType, entityId,
      lineage.requestId || null, identity.clientId, identity.runId, lineage.baseRevisionId || null, lineage.resultRevisionId || null,
      lineage.idempotencyHash || null, JSON.stringify(details), createdAt);
}

async function beginIdempotency(env, identity, route, key, body) {
  if (typeof key !== 'string' || key.length < 8 || key.length > 200) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'idempotencyKey must contain 8 to 200 characters');
  const scope = `${route}:${identity.actorId}`;
  const existing = await env.CONTENT_DB.prepare('SELECT request_hash, response_status, response_json FROM idempotency_records WHERE scope = ? AND idempotency_key = ?').bind(scope, key).first();
  const result = await resolveIdempotency({ existing, scope, key, request: body });
  if (result.kind === 'replay') return { replay: new Response(result.response_json, { status: result.response_status, headers: { ...JSON_HEADERS, 'idempotent-replay': 'true' } }) };
  return { scope, requestHash: result.requestHash };
}

function idempotencyStatement(env, idem, key, status, response, createdAt) {
  return env.CONTENT_DB.prepare('INSERT INTO idempotency_records (scope, idempotency_key, request_hash, response_status, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(idem.scope, key, idem.requestHash, status, JSON.stringify(response), createdAt);
}

async function listChapters(env) {
  const rows = await env.CONTENT_DB.prepare(`SELECT d.id, d.canonical_path, d.title, d.state, d.current_revision_id, d.current_content_hash, d.updated_at,
    a.authority, a.source_revision AS authority_source_revision FROM documents d LEFT JOIN authority_registry a ON a.document_id = d.id AND a.active = 1
    WHERE d.media_kind = 'text' AND d.state = 'active' ORDER BY d.canonical_path`).all();
  return json({ chapters: (rows.results || []).map((row) => ({ ...row, authoringState: row.id === 'chapter_ch07' || row.authority === 'd1' ? 'editable' : 'readOnly' })) });
}

async function loadCanonicalChapter(env, id) {
  const row = await env.CONTENT_DB.prepare(`SELECT d.id, d.canonical_path, d.title, d.state, d.current_revision_id, d.current_content_hash,
    r.content_text, r.metadata_json, r.created_at AS revision_created_at
    FROM documents d JOIN document_revisions r ON r.id = d.current_revision_id WHERE d.id = ? AND d.media_kind = 'text'`).bind(id).first();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Chapter was not found');
  const chapter = parseStoredJson(row.content_text, 'Canonical chapter');
  if (chapter.revisionId !== row.current_revision_id) throw new ApiError(500, 'REVISION_IDENTITY_MISMATCH', 'Canonical row and ChapterBundle revision identities differ');
  if (!Array.isArray(chapter.body) || chapter.body.length > 5000) throw new ApiError(500, 'CORRUPT_CONTENT', 'Canonical chapter body is missing or exceeds the read safety bound');
  return { row, chapter };
}

async function getChapter(env, id) {
  const { row, chapter } = await loadCanonicalChapter(env, id);
  const authority = await env.CONTENT_DB.prepare('SELECT authority, source_path, source_revision, normalized_snapshot_hash FROM authority_registry WHERE document_id = ? AND active = 1').bind(id).first();
  return json({ id: row.id, canonicalPath: row.canonical_path, title: row.title, state: row.state, revisionId: row.current_revision_id, contentHash: row.current_content_hash, revisionCreatedAt: row.revision_created_at, authoringState: id === 'chapter_ch07' || authority?.authority === 'd1' ? 'editable' : 'readOnly', authority: authority || null, chapter, metadata: parseStoredJson(row.metadata_json || '{}', 'Chapter metadata') });
}

async function listChapterRevisions(env, id, url) {
  const { limit, cursor } = pageParams(url, { defaultLimit: 20, maxLimit: 50 });
  const document = await env.CONTENT_DB.prepare("SELECT current_revision_id FROM documents WHERE id = ? AND media_kind = 'text' AND state = 'active'").bind(id).first();
  if (!document) throw new ApiError(404, 'NOT_FOUND', 'Chapter was not found');
  const rows = await env.CONTENT_DB.prepare(`SELECT id, parent_revision_id, content_hash, created_by, created_at, created_actor_type, created_client_id, created_run_id, metadata_json
    FROM document_revisions WHERE document_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`).bind(id, limit + 1, cursor).all();
  const page = (rows.results || []).slice(0, limit).map((row) => {
    const metadata = parseStoredJson(row.metadata_json || '{}', 'Revision metadata');
    return {
      revisionId: row.id,
      parentRevisionId: row.parent_revision_id || null,
      contentHash: row.content_hash,
      createdBy: row.created_by,
      createdAt: row.created_at,
      actorType: row.created_actor_type || null,
      clientId: row.created_client_id || null,
      runId: row.created_run_id || null,
      current: row.id === document.current_revision_id,
      status: metadata.status || null,
      publicationMode: metadata.publicationMode || null
    };
  });
  return json({ chapterId: id, currentRevisionId: document.current_revision_id, revisions: page, page: { limit, cursor: String(cursor), nextCursor: (rows.results || []).length > limit ? String(cursor + limit) : null } });
}

async function requireAuthoringAuthority(env, chapterId) {
  const authority = await env.CONTENT_DB.prepare('SELECT authority FROM authority_registry WHERE document_id = ? AND active = 1').bind(chapterId).first();
  if (chapterId !== 'chapter_ch07' && authority?.authority !== 'd1') throw new ApiError(409, 'AUTHORING_NOT_ENABLED', 'This chapter remains repository-authoritative and is read-only in the browser until its controlled D1 cutover');
  return authority;
}

const passageProjection = (block, index) => ({
  passageId: block.passageId, blockId: block.blockId || null, sectionId: block.sectionId || null, type: block.type || null, index,
  excerpt: typeof block.text === 'string' ? block.text.slice(0, 500) : Array.isArray(block.items) ? block.items.join(' ').slice(0, 500) : null
});

async function listChapterPassages(env, chapterId, url) {
  const { row, chapter } = await loadCanonicalChapter(env, chapterId);
  const { limit, cursor } = pageParams(url);
  const passages = chapter.body.map((block, index) => ({ block, index })).filter(({ block }) => typeof block?.passageId === 'string');
  const page = passages.slice(cursor, cursor + limit).map(({ block, index }) => passageProjection(block, index));
  const nextCursor = cursor + page.length < passages.length ? String(cursor + page.length) : null;
  return json({ chapterId, revisionId: row.current_revision_id, contentHash: row.current_content_hash, passages: page, page: { limit, cursor: String(cursor), nextCursor, total: passages.length } });
}

async function getChapterPassage(env, chapterId, passageId) {
  const { row, chapter } = await loadCanonicalChapter(env, chapterId);
  const matches = chapter.body.map((block, index) => ({ block, index })).filter(({ block }) => block?.passageId === passageId);
  if (matches.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Passage was not found');
  if (matches.length > 1) throw new ApiError(500, 'STABLE_ID_DUPLICATE', 'Canonical chapter contains a duplicate passage identity');
  return json({ chapterId, revisionId: row.current_revision_id, contentHash: row.current_content_hash, ...passageProjection(matches[0].block, matches[0].index), block: matches[0].block });
}

async function getChapterDependencies(env, chapterId, url) {
  const { row, chapter } = await loadCanonicalChapter(env, chapterId);
  const { limit, cursor } = pageParams(url, { defaultLimit: 50, maxLimit: 100, maxCursor: 10000 });
  const passageId = boundedQuery(url.searchParams.get('passageId'), 'passageId', 200);
  if (passageId) validId(passageId, 'passageId');
  const nodeMap = new Map();
  const edges = [];
  const addNode = (id, kind, details = {}) => { if (id && !nodeMap.has(id)) nodeMap.set(id, { id, kind, ...details }); };
  const addEdge = (source, target, kind) => { if (source && target) edges.push({ source, target, kind }); };
  chapter.body.forEach((block, index) => {
    if (block?.passageId) addNode(block.passageId, 'passage', { blockId: block.blockId || null, blockType: block.type || null, index });
    if (block?.sectionId) addNode(block.sectionId, 'section', { blockId: block.blockId || null, index });
    if (block?.type === 'mediaFigure') {
      addNode(block.figureId, 'mediaFigure', { blockId: block.blockId || null }); addNode(block.mediaId, 'media'); addNode(block.mediaVersionId, 'mediaVersion'); addNode(block.rightsCaseId, 'rightsCase');
      addEdge(block.figureId, block.anchorPassageId, 'anchoredTo'); addEdge(block.figureId, block.mediaId, 'usesMedia'); addEdge(block.figureId, block.mediaVersionId, 'pinsVersion'); addEdge(block.figureId, block.rightsCaseId, 'requiresRights');
    } else if (block?.type === 'externalEmbed') {
      addNode(block.embedId, 'externalEmbed', { provider: block.identity?.provider || null, blockId: block.blockId || null }); addEdge(block.embedId, block.anchorPassageId, 'anchoredTo');
    } else if (block?.type === 'richLink') {
      addNode(block.linkId, 'richLink', { blockId: block.blockId || null }); addEdge(block.linkId, block.anchorPassageId, 'anchoredTo');
    }
  });
  for (const checkpoint of Array.isArray(chapter.checkpoints) ? chapter.checkpoints.slice(0, 100) : []) {
    addNode(checkpoint.checkpointId, 'checkpoint', { slot: checkpoint.slot || null }); addEdge(checkpoint.checkpointId, checkpoint.passageId, 'anchoredTo');
  }
  edges.sort((a, b) => `${a.source}\0${a.kind}\0${a.target}`.localeCompare(`${b.source}\0${b.kind}\0${b.target}`));
  if (edges.length > 20000 || nodeMap.size > 10000) throw new ApiError(500, 'DEPENDENCY_GRAPH_TOO_LARGE', 'Canonical dependency graph exceeds the read safety bound');
  if (passageId && !nodeMap.has(passageId)) throw new ApiError(404, 'NOT_FOUND', 'Passage was not found');
  const selectedEdges = passageId ? edges.filter((edge) => edge.source === passageId || edge.target === passageId) : edges;
  const pageEdges = selectedEdges.slice(cursor, cursor + limit);
  const pageNodeIds = new Set(pageEdges.flatMap((edge) => [edge.source, edge.target]));
  const nodes = [...pageNodeIds].map((id) => nodeMap.get(id) || { id, kind: 'unresolved' }).sort((a, b) => a.id.localeCompare(b.id));
  const nextCursor = cursor + pageEdges.length < selectedEdges.length ? String(cursor + pageEdges.length) : null;
  return json({ chapterId, passageId: passageId || null, revisionId: row.current_revision_id, contentHash: row.current_content_hash, nodes, edges: pageEdges, unresolvedTargets: nodes.filter((item) => item.kind === 'unresolved').map((item) => item.id), page: { limit, cursor: String(cursor), nextCursor, totalEdges: selectedEdges.length, totalNodes: nodeMap.size } });
}

async function getChangeset(env, id) {
  const changeset = await env.CONTENT_DB.prepare('SELECT * FROM changesets WHERE id = ?').bind(id).first();
  if (!changeset) throw new ApiError(404, 'NOT_FOUND', 'Changeset was not found');
  const documents = await env.CONTENT_DB.prepare(`SELECT id, document_id, base_revision_id, content_hash, content_text, metadata_json,
    checkpoint, version, updated_at FROM working_documents WHERE changeset_id = ? ORDER BY document_id`).bind(id).all();
  const submitted = await env.CONTENT_DB.prepare(`SELECT id, snapshot_hash, snapshot_revision, document_count, created_at
    FROM submitted_snapshots WHERE changeset_id = ? LIMIT 1`).bind(id).first();
  const decision = submitted ? await env.CONTENT_DB.prepare(`SELECT id, decision, decision_kind, comment, decided_by, decided_at
    FROM approvals WHERE changeset_id = ? AND submitted_snapshot_hash = ? AND submitted_snapshot_revision = ?
    AND decision_kind = 'release' ORDER BY decided_at DESC, id DESC LIMIT 1`).bind(id, submitted.snapshot_hash, submitted.snapshot_revision).first() : null;
  return json({
    ...changeset,
    documents: (documents.results || []).map((item) => ({ ...item, content: parseStoredJson(item.content_text, 'Working document'), metadata: parseStoredJson(item.metadata_json || '{}', 'Working metadata'), content_text: undefined, metadata_json: undefined })),
    submittedSnapshot: submitted ? { snapshotId: submitted.id, snapshotHash: submitted.snapshot_hash, snapshotRevision: submitted.snapshot_revision, documentCount: submitted.document_count, submittedAt: submitted.created_at } : null,
    releaseDecision: decision ? { approvalId: decision.id, decision: decision.decision, decisionKind: decision.decision_kind, comment: decision.comment, decidedBy: decision.decided_by, decidedAt: decision.decided_at } : null,
  });
}

async function listWorkingDocuments(env, changesetId) {
  const rows = await env.CONTENT_DB.prepare(`SELECT w.*, c.state, c.purpose, d.current_revision_id, d.current_content_hash
    FROM working_documents w JOIN changesets c ON c.id = w.changeset_id
    JOIN documents d ON d.id = w.document_id WHERE w.changeset_id = ? ORDER BY w.document_id`).bind(changesetId).all();
  const documents = rows.results || [];
  if (!documents.length) throw new ApiError(404, 'NOT_FOUND', 'Changeset was not found');
  return documents;
}

function selectWorkingDocument(documents, documentId) {
  if (documentId !== undefined) {
    validId(documentId, 'documentId');
    const selected = documents.find((item) => item.document_id === documentId);
    if (!selected) throw new ApiError(404, 'DOCUMENT_NOT_IN_CHANGESET', 'Document is not part of this changeset');
    return selected;
  }
  if (documents.length !== 1) throw new ApiError(422, 'DOCUMENT_TARGET_REQUIRED', 'documentId is required for a multi-document changeset', { documentIds: documents.map((item) => item.document_id) });
  return documents[0];
}

const base64Url = (value) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

async function renderPreview(request, env, identity, changesetId) {
  requireScope(identity, 'content:write'); runIdentity(identity);
  const body = await readJsonBody(request, { allowedFields: ['documentId', 'baseRevisionId', 'expectedVersion', 'idempotencyKey', 'surface'] });
  validId(body.baseRevisionId, 'baseRevisionId');
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) throw new ApiError(428, 'PRECONDITION_REQUIRED', 'expectedVersion is required');
  if (body.surface !== undefined && !['web', 'mobile', 'print', 'offline'].includes(body.surface)) throw new ApiError(422, 'PREVIEW_SURFACE_INVALID', 'surface must be web, mobile, print, or offline');
  if (!env.CONTENT_SNAPSHOTS || !env.CONTENT_DB || typeof env.PREVIEW_TOKEN_SECRET !== 'string' || env.PREVIEW_TOKEN_SECRET.length < 32 || typeof env.PREVIEW_ORIGIN !== 'string') throw new ApiError(503, 'PREVIEW_UNAVAILABLE', 'Protected preview storage or signing configuration is unavailable');
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `changeset:${changesetId}:preview`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const working = selectWorkingDocument(await listWorkingDocuments(env, changesetId), body.documentId);
  if (working.state !== 'open') throw new ApiError(409, 'CHANGESET_NOT_OPEN', 'Only an open changeset can render a draft preview');
  if (body.baseRevisionId !== working.base_revision_id || working.current_revision_id !== working.base_revision_id || body.expectedVersion !== working.version) throw new ApiError(409, 'REVISION_CONFLICT', 'Preview preconditions are stale', { baseRevisionId: working.base_revision_id, currentRevisionId: working.current_revision_id, currentVersion: working.version });
  const chapter = parseStoredJson(working.content_text, 'Working document');
  const validation = validateChapter(chapter, { publishable: false });
  if (!validation.valid) throw new ApiError(422, 'VALIDATION_FAILED', 'Draft preview contains structurally invalid content', validation);
  const snapshot = { schemaVersion: 1, kind: 'draftPreview', changesetId, documentId: working.document_id, baseRevisionId: working.base_revision_id, workingVersion: working.version, contentHash: working.content_hash, surface: body.surface || 'web', chapter };
  const snapshotJson = stableStringify(snapshot);
  const snapshotHash = await sha256(snapshotJson);
  const objectKey = `previews/${snapshotHash}.json`;
  if (!await env.CONTENT_SNAPSHOTS.head(objectKey)) await env.CONTENT_SNAPSHOTS.put(objectKey, snapshotJson, { httpMetadata: { contentType: 'application/json' }, customMetadata: { sha256: snapshotHash, changesetId } });
  const issuedAt = Math.floor(Date.now() / 1000); const expiresAtEpoch = issuedAt + 300; const grantId = await deterministicId('preview', { changesetId, documentId: working.document_id, snapshotHash, idempotencyKey: body.idempotencyKey });
  const payload = base64Url(JSON.stringify({ v: 1, jti: grantId, sh: snapshotHash, exp: expiresAtEpoch }));
  const signature = await hmacSha256(env.PREVIEW_TOKEN_SECRET, payload); const token = `v1.${payload}.${signature}`; const tokenHash = await sha256(token); const createdAt = now(); const expiresAt = new Date(expiresAtEpoch * 1000).toISOString();
  const previewOrigin = new URL(env.PREVIEW_ORIGIN); if (previewOrigin.protocol !== 'https:' || previewOrigin.username || previewOrigin.password || previewOrigin.pathname !== '/') throw new ApiError(503, 'PREVIEW_UNAVAILABLE', 'Preview origin configuration is invalid');
  const previewUrl = `${previewOrigin.origin}/preview?token=${encodeURIComponent(token)}`;
  const response = { previewId: grantId, changesetId, documentId: working.document_id, snapshotHash, contentHash: working.content_hash, workingVersion: working.version, surface: body.surface || 'web', previewUrl, expiresAt, oneTime: true };
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare(`INSERT INTO preview_grants (id, token_hash, changeset_id, snapshot_hash, r2_object_key, surface, created_by, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(grantId, tokenHash, changesetId, snapshotHash, objectKey, body.surface || 'web', identity.actorId, createdAt, expiresAt),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, createdAt),
    await audit(env, identity, 'preview.issued', 'preview', grantId, { changesetId, snapshotHash, surface: body.surface || 'web', expiresAt }, { baseRevisionId: working.base_revision_id, idempotencyHash: idem.requestHash })
  ]);
  return json(response, 201);
}

async function createOrResumeChangeset(request, env, identity, chapterId) {
  requireScope(identity, 'content:write'); runIdentity(identity);
  const body = await readJsonBody(request, { allowedFields: ['title', 'description', 'idempotencyKey', 'resume'] });
  if (typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.length > 200) throw new ApiError(422, 'VALIDATION_FAILED', 'title is required and must be at most 200 characters');
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 2000)) throw new ApiError(422, 'VALIDATION_FAILED', 'description must be at most 2000 characters');
  await enforceRateLimit(env, identity, 'mutation');
  await requireAuthoringAuthority(env, chapterId);
  const idem = await beginIdempotency(env, identity, `chapter:${chapterId}:changeset`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const canonical = await env.CONTENT_DB.prepare(`SELECT d.id, d.current_revision_id, r.content_hash, r.content_text, r.r2_object_key, r.metadata_json
    FROM documents d JOIN document_revisions r ON r.id = d.current_revision_id WHERE d.id = ? AND d.state = 'active'`).bind(chapterId).first();
  if (!canonical) throw new ApiError(404, 'NOT_FOUND', 'Chapter was not found');

  if (body.resume === true) {
    const resumed = await env.CONTENT_DB.prepare(`SELECT c.id, c.state, c.created_at FROM changesets c JOIN working_documents w ON w.changeset_id = c.id
      WHERE c.created_by = ? AND c.state IN ('open', 'submitted', 'approved') AND w.document_id = ? ORDER BY c.updated_at DESC LIMIT 1`).bind(identity.actorId, chapterId).first();
    if (resumed) {
      const response = { id: resumed.id, state: resumed.state, resumed: true, created_at: resumed.created_at };
      await env.CONTENT_DB.batch([idempotencyStatement(env, idem, body.idempotencyKey, 200, response, now()), await audit(env, identity, 'changeset.resumed', 'changeset', resumed.id, { chapterId }, { idempotencyHash: idem.requestHash })]);
      return json(response);
    }
  }

  const createdAt = now();
  const changesetId = await deterministicId('cs', { chapterId, actorId: identity.actorId, clientId: identity.clientId, runId: identity.runId, idempotencyKey: body.idempotencyKey });
  const workingId = await deterministicId('wd', { changesetId, chapterId });
  const response = { id: changesetId, state: 'open', resumed: false, chapterId, baseRevisionId: canonical.current_revision_id, version: 1, created_at: createdAt };
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare(`INSERT INTO changesets
      (id, title, description, state, created_by, created_actor_type, created_client_id, created_run_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(changesetId, body.title.trim(), body.description || null, 'open', identity.actorId, identity.actorType, identity.clientId, identity.runId, createdAt, createdAt),
    env.CONTENT_DB.prepare(`INSERT INTO working_documents (id, changeset_id, document_id, base_revision_id, content_hash, content_text, r2_object_key, metadata_json, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(workingId, changesetId, chapterId, canonical.current_revision_id, canonical.content_hash, canonical.content_text, canonical.r2_object_key, canonical.metadata_json, identity.actorId, createdAt, createdAt),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, createdAt),
    await audit(env, identity, 'changeset.created', 'changeset', changesetId, { chapterId }, { baseRevisionId: canonical.current_revision_id, idempotencyHash: idem.requestHash })
  ]);
  return json(response, 201);
}

async function createMultiDocumentChangeset(request, env, identity, { authorityCutover = false } = {}) {
  if (authorityCutover) requireAuthorityWorkflowIdentity(identity); else { requireScope(identity, 'content:write'); runIdentity(identity); }
  const body = await readJsonBody(request, { allowedFields: ['title', 'description', 'targets', 'idempotencyKey'] });
  if (typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.length > 200) throw new ApiError(422, 'VALIDATION_FAILED', 'title is required and must be at most 200 characters');
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 2000)) throw new ApiError(422, 'VALIDATION_FAILED', 'description must be at most 2000 characters');
  if (!Array.isArray(body.targets) || body.targets.length < 1 || body.targets.length > 18) throw new ApiError(422, 'TARGETS_INVALID', 'targets must contain 1 to 18 document IDs');
  const targets = body.targets.map((target) => validId(target, 'target'));
  if (new Set(targets).size !== targets.length) throw new ApiError(422, 'TARGETS_INVALID', 'targets must be unique');
  targets.sort();
  await enforceRateLimit(env, identity, 'mutation');
  if (authorityCutover) {
    for (const documentId of targets) {
      const authority = await env.CONTENT_DB.prepare('SELECT authority FROM authority_registry WHERE document_id = ? AND active = 1').bind(documentId).first();
      if (authority?.authority !== 'git') throw new ApiError(409, 'CUTOVER_TARGET_INVALID', 'Cutover proposals accept only currently Git-authoritative chapters', { documentId, authority: authority?.authority || null });
    }
  } else for (const documentId of targets) await requireAuthoringAuthority(env, documentId);
  const idem = await beginIdempotency(env, identity, authorityCutover ? 'authority:prepareCutover' : 'changesets', body.idempotencyKey, { ...body, targets });
  if (idem.replay) return idem.replay;
  const canonicals = [];
  for (const documentId of targets) {
    const canonical = await env.CONTENT_DB.prepare(`SELECT d.id, d.current_revision_id, r.content_hash, r.content_text, r.r2_object_key, r.metadata_json
      FROM documents d JOIN document_revisions r ON r.id = d.current_revision_id WHERE d.id = ? AND d.state = 'active'`).bind(documentId).first();
    if (!canonical) throw new ApiError(404, 'NOT_FOUND', `Chapter ${documentId} was not found`);
    canonicals.push(canonical);
  }
  const createdAt = now();
  const changesetId = await deterministicId('cs', { targets, actorId: identity.actorId, clientId: identity.clientId, runId: identity.runId, idempotencyKey: body.idempotencyKey });
  const documents = [];
  const purpose = authorityCutover ? 'authority_cutover' : 'authoring';
  const statements = [env.CONTENT_DB.prepare(`INSERT INTO changesets
    (id, title, description, state, created_by, created_actor_type, created_client_id, created_run_id, created_at, updated_at, purpose)
    VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`).bind(changesetId, body.title.trim(), body.description || null, identity.actorId, identity.actorType, identity.clientId, identity.runId, createdAt, createdAt, purpose)];
  for (const canonical of canonicals) {
    const workingId = await deterministicId('wd', { changesetId, documentId: canonical.id });
    documents.push({ workingDocumentId: workingId, documentId: canonical.id, baseRevisionId: canonical.current_revision_id, contentHash: canonical.content_hash, version: 1 });
    statements.push(env.CONTENT_DB.prepare(`INSERT INTO working_documents
      (id, changeset_id, document_id, base_revision_id, content_hash, content_text, r2_object_key, metadata_json, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(workingId, changesetId, canonical.id, canonical.current_revision_id, canonical.content_hash, canonical.content_text, canonical.r2_object_key, canonical.metadata_json, identity.actorId, createdAt, createdAt));
  }
  const response = { id: changesetId, state: 'open', purpose, readOnly: authorityCutover, resumed: false, documents, created_at: createdAt };
  statements.push(idempotencyStatement(env, idem, body.idempotencyKey, 201, response, createdAt));
  statements.push(await audit(env, identity, authorityCutover ? 'authority.cutover.prepared' : 'changeset.created', 'changeset', changesetId, { documentIds: targets, documentCount: targets.length, purpose }, { idempotencyHash: idem.requestHash }));
  await env.CONTENT_DB.batch(statements);
  return json(response, 201);
}

async function restoreRevisionAsDraft(request, env, identity, chapterId, revisionId) {
  requireScope(identity, 'content:write'); runIdentity(identity);
  const body = await readJsonBody(request, { allowedFields: ['title', 'description', 'idempotencyKey'] });
  if (typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.length > 200) throw new ApiError(422, 'VALIDATION_FAILED', 'title is required and must be at most 200 characters');
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 2000)) throw new ApiError(422, 'VALIDATION_FAILED', 'description must be at most 2000 characters');
  await enforceRateLimit(env, identity, 'mutation');
  await requireAuthoringAuthority(env, chapterId);
  const idem = await beginIdempotency(env, identity, `chapter:${chapterId}:revision:${revisionId}:restore`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const row = await env.CONTENT_DB.prepare(`SELECT d.current_revision_id, current.content_hash AS current_content_hash,
    target.content_hash AS target_content_hash, target.content_text AS target_content_text, target.r2_object_key AS target_r2_object_key,
    target.metadata_json AS target_metadata_json
    FROM documents d JOIN document_revisions current ON current.id = d.current_revision_id
    JOIN document_revisions target ON target.document_id = d.id AND target.id = ?
    WHERE d.id = ? AND d.state = 'active'`).bind(revisionId, chapterId).first();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Chapter revision was not found');
  if (typeof row.target_content_text !== 'string') throw new ApiError(409, 'RESTORE_CONTENT_UNAVAILABLE', 'Historical revision is not available as editable structured content');
  const createdAt = now();
  const changesetId = await deterministicId('cs', { chapterId, revisionId, actorId: identity.actorId, clientId: identity.clientId, runId: identity.runId, idempotencyKey: body.idempotencyKey, action: 'restore' });
  const workingId = await deterministicId('wd', { changesetId, chapterId });
  const response = { id: changesetId, state: 'open', chapterId, restoredFromRevisionId: revisionId, baseRevisionId: row.current_revision_id, contentHash: row.target_content_hash, version: 1, createdAt };
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare(`INSERT INTO changesets
      (id, title, description, state, created_by, created_actor_type, created_client_id, created_run_id, restored_from_revision_id, created_at, updated_at)
      VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`).bind(changesetId, body.title.trim(), body.description || null, identity.actorId, identity.actorType, identity.clientId, identity.runId, revisionId, createdAt, createdAt),
    env.CONTENT_DB.prepare(`INSERT INTO working_documents
      (id, changeset_id, document_id, base_revision_id, content_hash, content_text, r2_object_key, metadata_json, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(workingId, changesetId, chapterId, row.current_revision_id, row.target_content_hash, row.target_content_text, row.target_r2_object_key, row.target_metadata_json, identity.actorId, createdAt, createdAt),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, createdAt),
    await audit(env, identity, 'changeset.restored_as_draft', 'changeset', changesetId, { chapterId, restoredFromRevisionId: revisionId, restoredContentHash: row.target_content_hash }, { baseRevisionId: row.current_revision_id, idempotencyHash: idem.requestHash })
  ]);
  return json(response, 201);
}

async function diffChangeset(request, env, changesetId) {
  const body = request.body === null ? {} : await readJsonBody(request, { allowedFields: ['documentId'] });
  if (body.documentId !== undefined) validId(body.documentId, 'documentId');
  const rows = await env.CONTENT_DB.prepare(`SELECT c.state, w.document_id, w.base_revision_id, w.content_hash, w.content_text, w.version,
    r.content_hash AS base_content_hash, r.content_text AS base_content_text
    FROM changesets c JOIN working_documents w ON w.changeset_id = c.id
    JOIN document_revisions r ON r.id = w.base_revision_id WHERE c.id = ? ORDER BY w.document_id`).bind(changesetId).all();
  let documents = rows.results || [];
  if (!documents.length) throw new ApiError(404, 'NOT_FOUND', 'Changeset was not found');
  if (body.documentId !== undefined) {
    documents = documents.filter((item) => item.document_id === body.documentId);
    if (!documents.length) throw new ApiError(404, 'DOCUMENT_NOT_IN_CHANGESET', 'Document is not part of this changeset');
  }
  const results = documents.map((working) => ({ documentId: working.document_id, baseRevisionId: working.base_revision_id, baseContentHash: working.base_content_hash, workingContentHash: working.content_hash, workingVersion: working.version, diff: semanticDiffChapter(parseStoredJson(working.base_content_text, 'Base revision'), parseStoredJson(working.content_text, 'Working document')) }));
  return json(results.length === 1 ? { changesetId, state: documents[0].state, ...results[0] } : { changesetId, state: documents[0].state, documentCount: results.length, documents: results });
}

async function applyOperation(request, env, identity, changesetId) {
  requireScope(identity, 'content:write'); runIdentity(identity);
  const body = await readJsonBody(request, { maxBytes: 1024 * 1024, allowedFields: ['documentId', 'baseRevisionId', 'expectedVersion', 'idempotencyKey', 'dryRun', 'operation'] });
  if (body.baseRevisionId === undefined) throw new ApiError(428, 'PRECONDITION_REQUIRED', 'baseRevisionId is required');
  validId(body.baseRevisionId, 'baseRevisionId');
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) throw new ApiError(428, 'PRECONDITION_REQUIRED', 'expectedVersion is required');
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `changeset:${changesetId}:apply`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const working = selectWorkingDocument(await listWorkingDocuments(env, changesetId), body.documentId);
  if (working.state !== 'open') throw new ApiError(409, 'CHANGESET_NOT_OPEN', 'Only an open changeset can be edited');
  if (working.purpose === 'authority_cutover') throw new ApiError(409, 'CUTOVER_PROPOSAL_READ_ONLY', 'Authority cutover proposals are immutable review snapshots and cannot be edited');
  if (body.baseRevisionId !== working.base_revision_id || working.current_revision_id !== working.base_revision_id) throw new ApiError(409, 'REVISION_CONFLICT', 'Canonical chapter changed after this changeset opened', { expected: working.base_revision_id, current: working.current_revision_id });
  if (body.expectedVersion !== working.version) throw new ApiError(409, 'REVISION_CONFLICT', 'Working document version is stale', { expectedVersion: body.expectedVersion, currentVersion: working.version });
  const result = await applySemanticOperation(parseStoredJson(working.content_text, 'Working document'), body.operation);
  const nextVersion = working.version + 1;
  const operationId = await deterministicId('op', { changesetId, documentId: working.document_id, idempotencyKey: body.idempotencyKey });
  const response = { operationId, changesetId, documentId: working.document_id, baseRevisionId: working.base_revision_id, version: body.dryRun === true ? working.version : nextVersion, contentHash: result.contentHash, dryRun: body.dryRun === true, chapter: result.chapter };
  if (body.dryRun === true) return json(response);
  const updatedAt = now();
  const update = env.CONTENT_DB.prepare(`UPDATE working_documents SET content_text = ?, content_hash = ?, checkpoint = checkpoint + 1,
    version = ?, updated_by = ?, updated_at = ? WHERE id = ? AND version = ?`).bind(stableStringify(result.chapter), result.contentHash, nextVersion, identity.actorId, updatedAt, working.id, working.version);
  const operation = env.CONTENT_DB.prepare(`INSERT INTO content_operations
    (id, changeset_id, document_id, operation_kind, operation_json, client_id, run_id, base_revision_id, result_revision_id, idempotency_hash, request_hash, result_hash, working_version, actor_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(operationId, changesetId, working.document_id, body.operation.type, stableStringify(body.operation), identity.clientId, identity.runId, working.base_revision_id, null, idem.requestHash, idem.requestHash, result.contentHash, nextVersion, identity.actorId, updatedAt);
  const batch = await env.CONTENT_DB.batch([update, operation, idempotencyStatement(env, idem, body.idempotencyKey, 200, response, updatedAt), await audit(env, identity, 'changeset.operation.applied', 'changeset', changesetId, { operationId, operationKind: body.operation.type, workingVersion: nextVersion }, { baseRevisionId: working.base_revision_id, idempotencyHash: idem.requestHash })]);
  if (batch[0]?.meta?.changes === 0) throw new ApiError(409, 'REVISION_CONFLICT', 'Working document was concurrently modified');
  return json(response);
}

async function validateChangeset(request, env, identity, changesetId) {
  requireScope(identity, 'content:write'); runIdentity(identity);
  await enforceRateLimit(env, identity, 'mutation');
  const workingDocuments = await listWorkingDocuments(env, changesetId);
  const documents = workingDocuments.map((working) => ({ documentId: working.document_id, contentHash: working.content_hash, baseRevisionId: working.base_revision_id, version: working.version, ...validateChapter(parseStoredJson(working.content_text, 'Working document'), { publishable: true }) }));
  const validation = { valid: documents.every((item) => item.valid), errors: documents.flatMap((item) => item.errors.map((error) => ({ documentId: item.documentId, ...error }))), documents };
  const validationHash = await sha256({ documents });
  const validatedAt = now();
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare('UPDATE changesets SET last_validation_hash = ?, last_validation_json = ?, updated_at = ? WHERE id = ?').bind(validationHash, JSON.stringify(validation), validatedAt, changesetId),
    await audit(env, identity, 'changeset.validated', 'changeset', changesetId, { validationHash, valid: validation.valid, errors: validation.errors, documentCount: documents.length })
  ]);
  if (!validation.valid) throw new ApiError(422, 'VALIDATION_FAILED', 'Changeset is not publishable', validation);
  if (documents.length === 1) return json({ changesetId, contentHash: documents[0].contentHash, validationHash, valid: true, errors: [] });
  return json({ changesetId, validationHash, ...validation });
}

async function saveChangesetLive(request, env, identity, changesetId) {
  requireScope(identity, 'content:write'); runIdentity(identity); requireLiveSaveIdentity(identity);
  const body = await readJsonBody(request, { allowedFields: ['baseRevisionId', 'expectedVersion', 'idempotencyKey'] });
  validId(body.baseRevisionId, 'baseRevisionId');
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) throw new ApiError(428, 'PRECONDITION_REQUIRED', 'expectedVersion is required');
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `changeset:${changesetId}:saveLive`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const working = selectWorkingDocument(await listWorkingDocuments(env, changesetId));
  if (working.state !== 'open') throw new ApiError(409, 'CHANGESET_NOT_OPEN', 'Only an open changeset can be saved live');
  await requireAuthoringAuthority(env, working.document_id);
  if (working.purpose === 'authority_cutover') throw new ApiError(409, 'CUTOVER_PROPOSAL_READ_ONLY', 'Authority cutover proposals cannot be saved live');
  if (body.baseRevisionId !== working.base_revision_id || working.current_revision_id !== working.base_revision_id || body.expectedVersion !== working.version) throw new ApiError(409, 'REVISION_CONFLICT', 'The chapter changed after this editor opened', { baseRevisionId: working.base_revision_id, currentRevisionId: working.current_revision_id, currentVersion: working.version });
  const chapter = parseStoredJson(working.content_text, 'Working document');
  const validation = validateChapter(chapter, { publishable: true });
  if (!validation.valid) throw new ApiError(422, 'VALIDATION_FAILED', 'The chapter cannot be saved live until its structural errors are resolved', validation);
  const savedAt = now();
  const finalized = await finalizeChapterRevision(chapter, { editorialContentHash: working.content_hash, status: 'published', actorId: identity.actorId, actorType: identity.actorType, updatedAt: savedAt });
  const existing = await env.CONTENT_DB.prepare('SELECT document_id, content_hash FROM document_revisions WHERE id = ?').bind(finalized.revisionId).first();
  if (existing && (existing.document_id !== working.document_id || existing.content_hash !== finalized.contentHash)) throw new ApiError(409, 'REVISION_CONFLICT', 'The live revision identity already exists with different content');
  const response = { changesetId, documentId: working.document_id, state: 'applied', live: true, revisionId: finalized.revisionId, contentHash: finalized.contentHash, savedAt, chapter: finalized.content };
  const statements = [];
  if (!existing) statements.push(env.CONTENT_DB.prepare(`INSERT INTO document_revisions
    (id, document_id, parent_revision_id, content_hash, content_text, r2_object_key, metadata_json, created_by, created_at, created_actor_type, created_client_id, created_run_id)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`).bind(finalized.revisionId, working.document_id, working.base_revision_id, finalized.contentHash, stableStringify(finalized.content), stableStringify({ status: 'published', publicationMode: 'instructor-live-save' }), identity.actorId, savedAt, identity.actorType, identity.clientId, identity.runId));
  statements.push(env.CONTENT_DB.prepare(`UPDATE documents SET current_revision_id = ?, current_content_hash = ?, updated_at = ?
    WHERE id = ? AND current_revision_id = ?`).bind(finalized.revisionId, finalized.contentHash, savedAt, working.document_id, working.base_revision_id));
  statements.push(env.CONTENT_DB.prepare("UPDATE changesets SET state = 'applied', applied_at = ?, updated_at = ? WHERE id = ? AND state = 'open'").bind(savedAt, savedAt, changesetId));
  statements.push(idempotencyStatement(env, idem, body.idempotencyKey, 201, response, savedAt));
  statements.push(await audit(env, identity, 'changeset.saved_live', 'changeset', changesetId, { documentId: working.document_id, revisionId: finalized.revisionId, publicationMode: 'instructor-live-save' }, { baseRevisionId: working.base_revision_id, resultRevisionId: finalized.revisionId, idempotencyHash: idem.requestHash }));
  const results = await env.CONTENT_DB.batch(statements);
  const updateResult = results[existing ? 0 : 1];
  if (updateResult?.meta?.changes === 0) throw new ApiError(409, 'REVISION_CONFLICT', 'The canonical chapter was concurrently modified');
  return json(response, 201);
}

export const releaseMediaKind = (mimeType, technical) => mimeType === 'application/pdf' ? 'pdf' : mimeType === 'text/plain' ? 'document' : mimeType.startsWith('audio/') ? 'audio' : mimeType.startsWith('video/') ? 'video' : technical?.animated ? 'gif' : 'image';

async function buildMediaProjection(env, chapter) {
  const placements = chapter.body.filter((block) => block?.type === 'mediaFigure');
  if (placements.length > 100) throw new ApiError(422, 'MEDIA_PLACEMENT_LIMIT', 'A chapter may reference at most 100 media figures');
  const versionMap = new Map();
  const assetMap = new Map();
  for (const placement of placements) {
    const pinned = await env.CONTENT_DB.prepare(`SELECT a.id AS media_id, a.title, a.state AS media_state,
      v.id AS media_version_id, v.source_sha256, v.source_bytes, v.detected_mime, v.immutable_address, v.technical_json,
      r.id AS rights_case_id, r.review_id, r.status AS rights_status, r.review_package_id,
      p.rights_json, p.editorial_json, p.accessibility_json, p.declaration_hash, p.state AS review_package_state
      FROM media_assets a JOIN media_asset_versions v ON v.media_id = a.id
      JOIN media_rights_cases r ON r.media_version_id = v.id
      LEFT JOIN media_review_packages p ON p.id = r.review_package_id
      WHERE a.id = ? AND v.id = ? AND r.id = ?`).bind(placement.mediaId, placement.mediaVersionId, placement.rightsCaseId).first();
    if (!pinned) throw new ApiError(422, 'MEDIA_PIN_NOT_FOUND', 'Media placement does not reference an exact persisted asset, version, and rights case', { figureId: placement.figureId });
    if (pinned.media_state !== 'ready' || pinned.rights_status !== 'cleared' || pinned.review_package_state !== 'cleared' || !/^[a-f0-9]{64}$/.test(pinned.declaration_hash || '')) throw new ApiError(422, 'MEDIA_RELEASE_NOT_CLEARED', 'Every media placement requires a ready asset and exact cleared review package/rights case', { figureId: placement.figureId, rightsStatus: pinned.rights_status, reviewPackageState: pinned.review_package_state || null });
    if (!/^[a-f0-9]{64}$/.test(pinned.source_sha256 || '') || !Number.isInteger(pinned.source_bytes) || pinned.source_bytes < 1 || !pinned.immutable_address) throw new ApiError(500, 'MEDIA_METADATA_INVALID', 'Pinned media source metadata is invalid');
    let version = versionMap.get(pinned.media_version_id);
    if (!version) {
      const technical = parseStoredJson(pinned.technical_json, 'Media technical metadata');
      const rights = parseStoredJson(pinned.rights_json || '{}', 'Media rights declaration');
      const objects = await env.CONTENT_DB.prepare(`SELECT id, role, object_key, object_sha256, object_bytes, content_type
        FROM media_version_objects WHERE media_version_id = ? ORDER BY role, id`).bind(pinned.media_version_id).all();
      if (!(objects.results || []).some((item) => item.role === 'derivative')) throw new ApiError(422, 'MEDIA_DERIVATIVE_MISSING', 'Pinned media version lacks an immutable release derivative', { mediaVersionId: pinned.media_version_id });
      const posterRequired = Boolean((typeof technical.poster === 'string' && /\.(?:webp|png|jpe?g)$/i.test(technical.poster)) || technical.poster?.file);
      if (posterRequired && !(objects.results || []).some((item) => item.role === 'poster')) throw new ApiError(422, 'MEDIA_POSTER_MISSING', 'Pinned media version lacks its required immutable poster', { mediaVersionId: pinned.media_version_id });
      const assetSha256s = [];
      for (const object of objects.results || []) {
        if (!/^[a-f0-9]{64}$/.test(object.object_sha256 || '') || !Number.isInteger(object.object_bytes) || object.object_bytes < 1 || !['derivative', 'poster', 'responsive-640', 'responsive-1280', 'responsive-1920'].includes(object.role) || !object.object_key?.startsWith('media/') || object.object_key.includes('..')) throw new ApiError(500, 'MEDIA_OBJECT_METADATA_INVALID', 'Pinned media object metadata is invalid');
        const projected = { sha256: object.object_sha256, bytes: object.object_bytes, mimeType: object.content_type, mediaId: pinned.media_id, mediaVersionId: pinned.media_version_id, rightsCaseId: pinned.rights_case_id, role: object.role, objectKey: object.object_key, downloadPath: `/v1/release-assets/${object.object_sha256}` };
        const prior = assetMap.get(object.object_sha256);
        if (prior && (prior.objectKey !== projected.objectKey || prior.bytes !== projected.bytes || prior.mimeType !== projected.mimeType)) throw new ApiError(500, 'MEDIA_HASH_COLLISION', 'One media hash maps to conflicting immutable metadata');
        assetMap.set(object.object_sha256, { ...projected, objectId: object.id }); assetSha256s.push(object.object_sha256);
      }
      version = {
        mediaId: pinned.media_id, mediaVersionId: pinned.media_version_id, title: pinned.title,
        kind: releaseMediaKind(pinned.detected_mime, technical),
        source: { sha256: pinned.source_sha256, bytes: pinned.source_bytes, mimeType: pinned.detected_mime, immutableAddress: pinned.immutable_address },
        rights: { rightsCaseId: pinned.rights_case_id, status: pinned.rights_status, reviewId: pinned.review_id, reviewPackageId: pinned.review_package_id, declarationHash: pinned.declaration_hash, credit: rights.attribution || null },
        technical, transcriptEquivalent: technical.transcriptEquivalent || null, assetSha256s: assetSha256s.sort()
      };
      versionMap.set(pinned.media_version_id, version);
    }
  }
  const assetsWithIds = [...assetMap.values()].sort((a, b) => `${a.mediaVersionId}:${a.role}:${a.sha256}`.localeCompare(`${b.mediaVersionId}:${b.role}:${b.sha256}`));
  const assets = assetsWithIds.map(({ objectId, ...item }) => item);
  const projectedPlacements = placements.map((placement) => {
    const version = versionMap.get(placement.mediaVersionId);
    const derivative = assets.find((item) => item.mediaVersionId === placement.mediaVersionId && item.role === 'derivative');
    const poster = assets.find((item) => item.mediaVersionId === placement.mediaVersionId && item.role === 'poster');
    return { figureId: placement.figureId, mediaId: placement.mediaId, mediaVersionId: placement.mediaVersionId, rightsCaseId: placement.rightsCaseId, kind: version.kind, derivativeSha256: derivative.sha256, posterSha256: poster?.sha256 || null, credit: version.rights.credit, transcriptEquivalent: version.transcriptEquivalent, downloadable: placement.downloadable === true };
  });
  return { projection: { schemaVersion: 1, assets, versions: [...versionMap.values()].sort((a, b) => a.mediaVersionId.localeCompare(b.mediaVersionId)), placements: projectedPlacements }, assetRows: assetsWithIds };
}

function mergeMediaProjections(items) {
  if (items.length === 1) return items[0].mediaProjection;
  const assets = new Map(); const versions = new Map(); const placements = []; const assetRows = new Map();
  for (const { documentId, mediaProjection } of items) {
    for (const asset of mediaProjection.projection.assets) {
      const prior = assets.get(asset.sha256);
      if (prior && stableStringify(prior) !== stableStringify(asset)) throw new ApiError(500, 'MEDIA_HASH_COLLISION', 'One media hash maps to conflicting immutable metadata');
      assets.set(asset.sha256, asset);
    }
    for (const version of mediaProjection.projection.versions) {
      const prior = versions.get(version.mediaVersionId);
      if (prior && stableStringify(prior) !== stableStringify(version)) throw new ApiError(500, 'MEDIA_VERSION_CONFLICT', 'One media version maps to conflicting immutable metadata');
      versions.set(version.mediaVersionId, version);
    }
    for (const placement of mediaProjection.projection.placements) placements.push({ documentId, ...placement });
    for (const row of mediaProjection.assetRows) assetRows.set(`${row.mediaVersionId}:${row.role}:${row.sha256}`, row);
  }
  return {
    projection: { schemaVersion: 1, assets: [...assets.values()].sort((a, b) => a.sha256.localeCompare(b.sha256)), versions: [...versions.values()].sort((a, b) => a.mediaVersionId.localeCompare(b.mediaVersionId)), placements: placements.sort((a, b) => `${a.documentId}:${a.figureId}`.localeCompare(`${b.documentId}:${b.figureId}`)) },
    assetRows: [...assetRows.values()].sort((a, b) => `${a.mediaVersionId}:${a.role}:${a.sha256}`.localeCompare(`${b.mediaVersionId}:${b.role}:${b.sha256}`))
  };
}

async function submitChangeset(request, env, identity, changesetId) {
  requireScope(identity, 'content:submit'); runIdentity(identity);
  const body = await readJsonBody(request, { allowedFields: ['baseRevisionId', 'expectedVersion', 'documents', 'idempotencyKey'] });
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `changeset:${changesetId}:submit`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const workingDocuments = await listWorkingDocuments(env, changesetId);
  if (workingDocuments[0].state !== 'open') throw new ApiError(409, 'CHANGESET_NOT_OPEN', 'Only an open changeset can be submitted');
  if (workingDocuments[0].purpose === 'authority_cutover' && workingDocuments.some((item) => item.content_hash !== item.current_content_hash)) throw new ApiError(409, 'CUTOVER_PROPOSAL_CHANGED', 'An authority cutover proposal must remain byte-for-byte equal to the seeded canonical chapter');
  let preconditions;
  if (body.documents !== undefined) {
    if (!Array.isArray(body.documents) || body.documents.length !== workingDocuments.length) throw new ApiError(428, 'PRECONDITION_REQUIRED', 'documents must bind every working document exactly once');
    preconditions = new Map();
    for (const item of body.documents) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some((key) => !['documentId', 'baseRevisionId', 'expectedVersion'].includes(key))) throw new ApiError(422, 'PRECONDITION_INVALID', 'Each document precondition must contain only documentId, baseRevisionId, and expectedVersion');
      validId(item.documentId, 'documentId'); validId(item.baseRevisionId, 'baseRevisionId');
      if (!Number.isInteger(item.expectedVersion) || item.expectedVersion < 1 || preconditions.has(item.documentId)) throw new ApiError(422, 'PRECONDITION_INVALID', 'Document preconditions must be unique and include a positive expectedVersion');
      preconditions.set(item.documentId, item);
    }
  } else {
    if (workingDocuments.length !== 1 || body.baseRevisionId === undefined || !Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) throw new ApiError(428, 'PRECONDITION_REQUIRED', 'Multi-document submission requires a documents precondition for every target');
    validId(body.baseRevisionId, 'baseRevisionId');
    preconditions = new Map([[workingDocuments[0].document_id, { documentId: workingDocuments[0].document_id, baseRevisionId: body.baseRevisionId, expectedVersion: body.expectedVersion }]]);
  }
  const conflicts = [];
  for (const working of workingDocuments) {
    const expected = preconditions.get(working.document_id);
    if (!expected || expected.baseRevisionId !== working.base_revision_id || working.current_revision_id !== working.base_revision_id || expected.expectedVersion !== working.version) conflicts.push({ documentId: working.document_id, baseRevisionId: working.base_revision_id, currentRevisionId: working.current_revision_id, currentVersion: working.version });
  }
  if (conflicts.length) throw new ApiError(409, 'REVISION_CONFLICT', 'One or more changeset documents are stale', { conflicts });
  const submittedAt = now();
  const projected = []; const documents = [];
  for (const working of workingDocuments) {
    const chapter = parseStoredJson(working.content_text, 'Working document');
    const validation = validateChapter(chapter, { publishable: true });
    if (!validation.valid) throw new ApiError(422, 'VALIDATION_FAILED', 'Changeset is not publishable', { documentId: working.document_id, ...validation });
    const finalized = await finalizeChapterRevision(chapter, { editorialContentHash: working.content_hash, status: 'published', actorId: identity.actorId, actorType: identity.actorType, updatedAt: submittedAt });
    documents.push({ documentId: working.document_id, baseRevisionId: working.base_revision_id, editorialContentHash: working.content_hash, submittedContentHash: finalized.contentHash, revisionId: finalized.revisionId, content: finalized.content });
    projected.push({ documentId: working.document_id, mediaProjection: await buildMediaProjection(env, chapter) });
  }
  const changedDocumentIds = new Set(workingDocuments.map((item) => item.document_id));
  const inheritedRows = await env.CONTENT_DB.prepare(`SELECT d.id AS document_id, d.current_revision_id, d.current_content_hash,
    r.content_text, r.r2_object_key, r.metadata_json
    FROM authority_registry a JOIN documents d ON d.id = a.document_id
    JOIN document_revisions r ON r.id = d.current_revision_id
    WHERE a.active = 1 AND a.authority = 'd1' ORDER BY d.id`).all();
  for (const inherited of inheritedRows.results || []) {
    if (changedDocumentIds.has(inherited.document_id)) continue;
    if (typeof inherited.content_text !== 'string') throw new ApiError(409, 'INHERITED_CONTENT_UNAVAILABLE', 'An active D1 chapter is not available as structured release content', { documentId: inherited.document_id });
    const chapter = parseStoredJson(inherited.content_text, 'Inherited canonical document');
    const validation = validateChapter(chapter, { publishable: true });
    if (!validation.valid) throw new ApiError(409, 'INHERITED_CONTENT_INVALID', 'An active D1 chapter is no longer release-valid', { documentId: inherited.document_id, ...validation });
    if (chapter.revisionId !== inherited.current_revision_id || chapter.chapterVersion !== inherited.current_revision_id || await sha256(chapter) !== inherited.current_content_hash) throw new ApiError(409, 'INHERITED_REVISION_MISMATCH', 'An active D1 chapter does not match its canonical revision receipt', { documentId: inherited.document_id });
    documents.push({ documentId: inherited.document_id, baseRevisionId: inherited.current_revision_id, editorialContentHash: inherited.current_content_hash, submittedContentHash: inherited.current_content_hash, revisionId: inherited.current_revision_id, inherited: true, content: chapter });
    projected.push({ documentId: inherited.document_id, mediaProjection: await buildMediaProjection(env, chapter) });
  }
  documents.sort((a, b) => a.documentId.localeCompare(b.documentId));
  const mediaProjection = mergeMediaProjections(projected);
  const snapshot = { schemaVersion: 2, changesetId, documents, mediaProjection: mediaProjection.projection };
  const snapshotJson = stableStringify(snapshot);
  const snapshotHash = await sha256(snapshotJson);
  const snapshotRevision = await deterministicId('snapshotrev', { changesetId, snapshotHash });
  const snapshotId = await deterministicId('snapshot', { changesetId, snapshotHash });
  const objectKey = `submitted/${snapshotHash}.json`;
  if (!env.CONTENT_SNAPSHOTS) throw new ApiError(503, 'SNAPSHOT_STORE_UNAVAILABLE', 'Snapshot storage is unavailable');
  if (await env.CONTENT_SNAPSHOTS.head(objectKey)) throw new ApiError(409, 'SNAPSHOT_EXISTS', 'Immutable snapshot key already exists');
  await env.CONTENT_SNAPSHOTS.put(objectKey, snapshotJson, { httpMetadata: { contentType: 'application/json' }, customMetadata: { sha256: snapshotHash, changesetId } });
  const response = documents.length === 1
    ? { changesetId, state: 'submitted', snapshotId, snapshotHash, snapshotRevision, objectKey, editorialContentHash: documents[0].editorialContentHash, submittedContentHash: documents[0].submittedContentHash, revisionId: documents[0].revisionId, submittedAt }
    : { changesetId, state: 'submitted', snapshotId, snapshotHash, snapshotRevision, objectKey, documentCount: documents.length, changedDocumentCount: workingDocuments.length, inheritedDocumentCount: documents.length - workingDocuments.length, documents: documents.map(({ content, ...item }) => item), submittedAt };
  const statements = [
    env.CONTENT_DB.prepare('INSERT INTO submitted_snapshots (id, changeset_id, snapshot_hash, snapshot_revision, r2_object_key, document_count, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(snapshotId, changesetId, snapshotHash, snapshotRevision, objectKey, documents.length, identity.actorId, submittedAt),
    env.CONTENT_DB.prepare("UPDATE changesets SET state = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ? AND state = 'open'").bind(submittedAt, submittedAt, changesetId),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, submittedAt),
    await audit(env, identity, 'changeset.submitted', 'changeset', changesetId, { snapshotId, snapshotHash, snapshotRevision, documentCount: documents.length, mediaVersions: mediaProjection.projection.versions.map((item) => item.mediaVersionId), mediaAssetHashes: mediaProjection.projection.assets.map((item) => item.sha256), revisionFinalization: documents.map(({ documentId, editorialContentHash, submittedContentHash, revisionId }) => ({ documentId, editorialContentHash, submittedContentHash, revisionId, status: 'published', transformation: 'server-finalized-publishable-candidate' })) }, { idempotencyHash: idem.requestHash })
  ];
  for (const asset of mediaProjection.assetRows) statements.splice(1, 0, env.CONTENT_DB.prepare(`INSERT INTO submitted_snapshot_media_assets
    (snapshot_id, media_id, media_version_id, rights_case_id, object_id, object_sha256, object_key, object_bytes, content_type, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(snapshotId, asset.mediaId, asset.mediaVersionId, asset.rightsCaseId, asset.objectId, asset.sha256, asset.objectKey, asset.bytes, asset.mimeType, asset.role, submittedAt));
  await env.CONTENT_DB.batch(statements);
  return json(response, 201);
}

async function approveChangeset(request, env, identity, changesetId) {
  requireScope(identity, 'content:approve'); runIdentity(identity); requireHumanIdentity(identity, 'Approval');
  const body = await readJsonBody(request, { allowedFields: ['snapshotHash', 'snapshotRevision', 'decisionKind', 'comment', 'idempotencyKey'] });
  if (!['content', 'rights', 'editorial', 'release'].includes(body.decisionKind)) throw new ApiError(422, 'APPROVAL_KIND_INVALID', 'decisionKind is invalid');
  if (body.comment !== undefined && (typeof body.comment !== 'string' || body.comment.length > 2000)) throw new ApiError(422, 'VALIDATION_FAILED', 'comment must be at most 2000 characters');
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `changeset:${changesetId}:approve`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const snapshot = await env.CONTENT_DB.prepare(`SELECT s.*, c.state FROM submitted_snapshots s JOIN changesets c ON c.id = s.changeset_id WHERE s.changeset_id = ?`).bind(changesetId).first();
  if (!snapshot) throw new ApiError(404, 'NOT_FOUND', 'Submitted snapshot was not found');
  if (snapshot.state !== 'submitted' && snapshot.state !== 'approved') throw new ApiError(409, 'CHANGESET_NOT_SUBMITTED', 'Only a submitted changeset can be approved');
  if (body.snapshotHash !== snapshot.snapshot_hash || body.snapshotRevision !== snapshot.snapshot_revision) throw new ApiError(409, 'REVISION_CONFLICT', 'Approval must bind the exact submitted snapshot', { snapshotHash: snapshot.snapshot_hash, snapshotRevision: snapshot.snapshot_revision });
  const approvalId = await deterministicId('approval', { changesetId, snapshotHash: body.snapshotHash, decisionKind: body.decisionKind, actorId: identity.actorId });
  const createdAt = now();
  const response = { approvalId, changesetId, decision: 'approved', decisionKind: body.decisionKind, snapshotHash: snapshot.snapshot_hash, snapshotRevision: snapshot.snapshot_revision, decidedBy: identity.actorId, createdAt };
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare(`INSERT INTO approvals (id, changeset_id, submitted_snapshot_id, submitted_snapshot_hash, submitted_snapshot_revision, subject_revision_id, decision_kind, decision, decided_by, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)`).bind(approvalId, changesetId, snapshot.id, snapshot.snapshot_hash, snapshot.snapshot_revision, snapshot.snapshot_revision, body.decisionKind, identity.actorId, body.comment || null, createdAt),
    env.CONTENT_DB.prepare("UPDATE changesets SET state = CASE WHEN ? = 'release' THEN 'approved' ELSE state END, updated_at = ? WHERE id = ?").bind(body.decisionKind, createdAt, changesetId),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, createdAt),
    await audit(env, identity, 'changeset.approved', 'changeset', changesetId, { approvalId, decisionKind: body.decisionKind, snapshotHash: snapshot.snapshot_hash }, { resultRevisionId: snapshot.snapshot_revision, idempotencyHash: idem.requestHash })
  ]);
  return json(response, 201);
}

async function rejectChangeset(request, env, identity, changesetId) {
  requireScope(identity, 'content:approve'); runIdentity(identity); requireHumanIdentity(identity, 'Rejection');
  const body = await readJsonBody(request, { allowedFields: ['snapshotHash', 'snapshotRevision', 'decisionKind', 'comment', 'idempotencyKey'] });
  if (!['content', 'rights', 'editorial', 'release'].includes(body.decisionKind)) throw new ApiError(422, 'APPROVAL_KIND_INVALID', 'decisionKind is invalid');
  if (typeof body.comment !== 'string' || body.comment.trim().length < 1 || body.comment.length > 2000) throw new ApiError(422, 'REJECTION_REASON_REQUIRED', 'comment is required and must be at most 2000 characters');
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `changeset:${changesetId}:reject`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const snapshot = await env.CONTENT_DB.prepare(`SELECT s.*, c.state FROM submitted_snapshots s JOIN changesets c ON c.id = s.changeset_id WHERE s.changeset_id = ?`).bind(changesetId).first();
  if (!snapshot) throw new ApiError(404, 'NOT_FOUND', 'Submitted snapshot was not found');
  if (snapshot.state !== 'submitted' && snapshot.state !== 'approved') throw new ApiError(409, 'CHANGESET_NOT_SUBMITTED', 'Only a submitted or approved changeset can be rejected');
  if (body.snapshotHash !== snapshot.snapshot_hash || body.snapshotRevision !== snapshot.snapshot_revision) throw new ApiError(409, 'REVISION_CONFLICT', 'Rejection must bind the exact submitted snapshot', { snapshotHash: snapshot.snapshot_hash, snapshotRevision: snapshot.snapshot_revision });
  const decisionId = await deterministicId('approval', { changesetId, snapshotHash: body.snapshotHash, decisionKind: body.decisionKind, decision: 'rejected', actorId: identity.actorId });
  const createdAt = now();
  const response = { approvalId: decisionId, changesetId, decision: 'rejected', decisionKind: body.decisionKind, snapshotHash: snapshot.snapshot_hash, snapshotRevision: snapshot.snapshot_revision, decidedBy: identity.actorId, comment: body.comment.trim(), createdAt };
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare(`INSERT INTO approvals (id, changeset_id, submitted_snapshot_id, submitted_snapshot_hash, submitted_snapshot_revision, subject_revision_id, decision_kind, decision, decided_by, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'rejected', ?, ?, ?)`).bind(decisionId, changesetId, snapshot.id, snapshot.snapshot_hash, snapshot.snapshot_revision, snapshot.snapshot_revision, body.decisionKind, identity.actorId, body.comment.trim(), createdAt),
    env.CONTENT_DB.prepare("UPDATE changesets SET state = 'rejected', updated_at = ? WHERE id = ? AND state IN ('submitted', 'approved')").bind(createdAt, changesetId),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, createdAt),
    await audit(env, identity, 'changeset.rejected', 'changeset', changesetId, { decisionId, decisionKind: body.decisionKind, snapshotHash: snapshot.snapshot_hash, comment: body.comment.trim() }, { resultRevisionId: snapshot.snapshot_revision, idempotencyHash: idem.requestHash })
  ]);
  return json(response, 201);
}

async function publishChangeset(request, env, identity, changesetId) {
  requireScope(identity, 'content:publish'); runIdentity(identity); requireHumanIdentity(identity, 'Publication');
  const body = await readJsonBody(request, { allowedFields: ['snapshotHash', 'snapshotRevision', 'idempotencyKey'] });
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `changeset:${changesetId}:publish`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const snapshot = await env.CONTENT_DB.prepare(`SELECT s.*, c.state FROM submitted_snapshots s JOIN changesets c ON c.id = s.changeset_id WHERE s.changeset_id = ?`).bind(changesetId).first();
  if (!snapshot) throw new ApiError(404, 'NOT_FOUND', 'Submitted snapshot was not found');
  if (snapshot.state !== 'approved') throw new ApiError(409, 'CHANGESET_NOT_APPROVED', 'Publication requires the changeset to remain approved; a rejected or merely submitted snapshot cannot publish');
  if (body.snapshotHash !== snapshot.snapshot_hash || body.snapshotRevision !== snapshot.snapshot_revision) throw new ApiError(409, 'REVISION_CONFLICT', 'Publish request does not match the submitted snapshot');
  // The protected service routes own deployment staging, receipts, and the
  // expected-active CAS. Keep this human endpoint permanently fail-closed so
  // there is only one production promotion control plane.
  throw new ApiError(503, 'DEPLOYMENT_RECEIPT_REQUIRED', 'Direct Content API publication is disabled; use the protected immutable release workflow and record its deployment receipt before authority activation');
}

const activeReleaseId = async (env) => (await env.CONTENT_DB.prepare("SELECT release_id FROM release_pointers WHERE name = 'active'").first())?.release_id || null;
const assertExpectedActive = (expected, current) => {
  if (expected !== current) throw new ApiError(409, 'ACTIVE_RELEASE_CONFLICT', 'Active release changed; the protected workflow must not promote or record a stale deployment', { expectedActiveReleaseId: expected, currentActiveReleaseId: current });
};

async function allocateReleaseSequence(env, changedAt) {
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare("INSERT OR IGNORE INTO release_sequences (name, next_sequence, updated_at) VALUES ('book', 1, ?)").bind(changedAt)
  ]);
  const allocated = await env.CONTENT_DB.prepare("UPDATE release_sequences SET next_sequence = next_sequence + 1, updated_at = ? WHERE name = 'book' RETURNING next_sequence - 1 AS sequence").bind(changedAt).first();
  if (!Number.isInteger(allocated?.sequence) || allocated.sequence < 1) throw new ApiError(503, 'RELEASE_SEQUENCE_UNAVAILABLE', 'Monotonic release sequence allocation failed closed');
  return allocated.sequence;
}

async function stageReleaseDeployment(request, env, identity) {
  requireReleaseWorkflowIdentity(identity);
  const body = await readJsonBody(request, { allowedFields: ['candidateId', 'snapshotHash', 'snapshotRevision', 'candidateManifestHash', 'buildAttestationHash', 'expectedActiveReleaseId', 'previousCloudflareVersionId', 'cloudflareVersionId', 'authorityEntries', 'idempotencyKey'] });
  validId(body.candidateId, 'candidateId'); exactHash(body.snapshotHash, 'snapshotHash'); validId(body.snapshotRevision, 'snapshotRevision');
  exactHash(body.candidateManifestHash, 'candidateManifestHash'); exactHash(body.buildAttestationHash, 'buildAttestationHash'); validId(body.previousCloudflareVersionId, 'previousCloudflareVersionId'); validId(body.cloudflareVersionId, 'cloudflareVersionId');
  if (body.previousCloudflareVersionId === body.cloudflareVersionId) throw new ApiError(422, 'DEPLOYMENT_BINDING_MISMATCH', 'Candidate and recovery Cloudflare versions must be distinct');
  if (!Array.isArray(body.authorityEntries) || body.authorityEntries.length !== 18) throw new ApiError(422, 'RELEASE_AUTHORITY_INVALID', 'authorityEntries must contain the complete 18-chapter release authority map');
  const authorityIds = new Set();
  const authorityEntries = body.authorityEntries.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some((key) => !['documentId', 'authority', 'sourcePath', 'sourceRevision', 'normalizedSnapshotHash'].includes(key))) throw new ApiError(422, 'RELEASE_AUTHORITY_INVALID', 'Release authority entries contain unsupported fields');
    const documentId = validId(item.documentId, 'documentId'); const sourceRevision = validId(item.sourceRevision, 'sourceRevision'); exactHash(item.normalizedSnapshotHash, 'normalizedSnapshotHash');
    if (!['git', 'd1'].includes(item.authority) || (item.authority === 'git' && (typeof item.sourcePath !== 'string' || !/^content\/chapters\/[A-Za-z0-9._/-]+\/$/.test(item.sourcePath) || item.sourcePath.includes('..'))) || (item.authority === 'd1' && item.sourcePath !== null)) throw new ApiError(422, 'RELEASE_AUTHORITY_INVALID', 'Release authority entry is invalid');
    if (authorityIds.has(documentId)) throw new ApiError(422, 'RELEASE_AUTHORITY_INVALID', 'Release authority document IDs must be unique');
    authorityIds.add(documentId); return { documentId, authority: item.authority, sourcePath: item.sourcePath, sourceRevision, normalizedSnapshotHash: item.normalizedSnapshotHash };
  }).sort((a, b) => a.documentId.localeCompare(b.documentId));
  const expectedActiveReleaseId = optionalReleaseId(body.expectedActiveReleaseId);
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, 'release-deployments:stage', body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const snapshot = await env.CONTENT_DB.prepare(`SELECT s.id, s.changeset_id, s.snapshot_hash, s.snapshot_revision, c.state
    FROM submitted_snapshots s JOIN changesets c ON c.id = s.changeset_id
    WHERE s.snapshot_hash = ? AND s.snapshot_revision = ?`).bind(body.snapshotHash, body.snapshotRevision).first();
  if (!snapshot) throw new ApiError(404, 'SUBMITTED_SNAPSHOT_NOT_FOUND', 'The staged candidate does not reference a persisted submitted snapshot');
  const currentActiveReleaseId = await activeReleaseId(env);
  assertExpectedActive(expectedActiveReleaseId, currentActiveReleaseId);
  const activeRelease = expectedActiveReleaseId ? await env.CONTENT_DB.prepare(`SELECT id, changeset_id, state, snapshot_hash, snapshot_revision, cloudflare_version_id
    FROM releases WHERE id = ?`).bind(expectedActiveReleaseId).first() : null;
  const reusesActiveSnapshot = snapshot.state === 'applied'
    && activeRelease?.state === 'published'
    && activeRelease.changeset_id === snapshot.changeset_id
    && activeRelease.snapshot_hash === body.snapshotHash
    && activeRelease.snapshot_revision === body.snapshotRevision;
  if (snapshot.state !== 'approved' && !reusesActiveSnapshot) throw new ApiError(409, 'CHANGESET_NOT_APPROVED', 'A staged deployment requires an exact still-approved change set, or the unchanged snapshot of the expected active release for a code-only deployment');
  const approval = await env.CONTENT_DB.prepare(`SELECT id FROM approvals WHERE changeset_id = ? AND submitted_snapshot_hash = ? AND submitted_snapshot_revision = ?
    AND decision_kind = 'release' AND decision = 'approved' LIMIT 1`).bind(snapshot.changeset_id, body.snapshotHash, body.snapshotRevision).first();
  if (!approval) throw new ApiError(409, 'APPROVAL_REQUIRED', 'The staged candidate lacks exact human release approval');
  if (!reusesActiveSnapshot) {
    const stale = await env.CONTENT_DB.prepare(`SELECT COUNT(*) AS stale_count FROM working_documents w JOIN documents d ON d.id = w.document_id
      WHERE w.changeset_id = ? AND d.current_revision_id <> w.base_revision_id`).bind(snapshot.changeset_id).first();
    if ((stale?.stale_count || 0) > 0) throw new ApiError(409, 'REVISION_CONFLICT', 'A submitted changeset target became stale before release staging');
  }
  const previousRelease = activeRelease;
  if (expectedActiveReleaseId && !previousRelease?.cloudflare_version_id) throw new ApiError(409, 'ROLLBACK_VERSION_UNAVAILABLE', 'The active release lacks an immutable Cloudflare version for emergency rollback');
  if (previousRelease?.cloudflare_version_id && previousRelease.cloudflare_version_id !== body.previousCloudflareVersionId) throw new ApiError(409, 'ROLLBACK_VERSION_MISMATCH', 'Provided recovery version does not match the active release receipt');
  const stagedAt = now();
  const sequence = await allocateReleaseSequence(env, stagedAt);
  // A verified candidate may be uploaded again after an interrupted attempt.
  // The immutable Cloudflare version distinguishes those deployable artifacts;
  // omitting it made an abandoned release permanently block a safe retry.
  const releaseId = await deterministicId('release', {
    candidateId: body.candidateId,
    candidateManifestHash: body.candidateManifestHash,
    cloudflareVersionId: body.cloudflareVersionId
  });
  const transactionId = await deterministicId('deployment', { action: 'promote', releaseId, expectedActiveReleaseId, idempotencyKey: body.idempotencyKey });
  const expiresAt = new Date(Date.parse(stagedAt) + 10 * 60 * 1000).toISOString();
  const response = { transactionId, action: 'promote', state: 'staged', releaseId, sequence, candidateId: body.candidateId, snapshotHash: body.snapshotHash, snapshotRevision: body.snapshotRevision, candidateManifestHash: body.candidateManifestHash, buildAttestationHash: body.buildAttestationHash, expectedActiveReleaseId, previousCloudflareVersionId: body.previousCloudflareVersionId, cloudflareVersionId: body.cloudflareVersionId, authorityDocumentCount: authorityEntries.length, expiresAt };
  const statements = [
    env.CONTENT_DB.prepare(`INSERT INTO releases
      (id, sequence, changeset_id, state, manifest_hash, created_by, created_at, candidate_id, snapshot_hash, snapshot_revision, build_attestation_hash, cloudflare_version_id)
      VALUES (?, ?, ?, 'building', ?, ?, ?, ?, ?, ?, ?, ?)`).bind(releaseId, sequence, snapshot.changeset_id, body.candidateManifestHash, identity.actorId, stagedAt, body.candidateId, body.snapshotHash, body.snapshotRevision, body.buildAttestationHash, body.cloudflareVersionId),
  ];
  for (const entry of authorityEntries) statements.push(env.CONTENT_DB.prepare(`INSERT INTO release_authority_entries
    (release_id, document_id, authority, source_path, source_revision, normalized_snapshot_hash)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(releaseId, entry.documentId, entry.authority, entry.sourcePath, entry.sourceRevision, entry.normalizedSnapshotHash));
  statements.push(env.CONTENT_DB.prepare(`INSERT INTO release_deployment_transactions
      (id, action, state, release_id, candidate_id, submitted_snapshot_id, snapshot_hash, snapshot_revision, candidate_manifest_hash, build_attestation_hash,
       expected_active_release_id, previous_cloudflare_version_id, cloudflare_version_id, staged_by, staged_client_id, staged_run_id, created_at, expires_at)
      VALUES (?, 'promote', 'staged', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(transactionId, releaseId, body.candidateId, snapshot.id, body.snapshotHash, body.snapshotRevision, body.candidateManifestHash, body.buildAttestationHash, expectedActiveReleaseId, body.previousCloudflareVersionId, body.cloudflareVersionId, identity.actorId, identity.clientId, identity.runId, stagedAt, expiresAt),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, stagedAt),
    await audit(env, identity, 'release.deployment.staged', 'release', releaseId, { transactionId, candidateId: body.candidateId, snapshotHash: body.snapshotHash, candidateManifestHash: body.candidateManifestHash, buildAttestationHash: body.buildAttestationHash, expectedActiveReleaseId, cloudflareVersionId: body.cloudflareVersionId, approvalId: approval.id, authorityDocumentCount: authorityEntries.length, reusesActiveSnapshot }, { idempotencyHash: idem.requestHash }));
  await env.CONTENT_DB.batch(statements);
  return json(response, 201);
}

async function stageReleaseRollback(request, env, identity, releaseId) {
  requireReleaseWorkflowIdentity(identity);
  const body = await readJsonBody(request, { allowedFields: ['expectedActiveReleaseId', 'idempotencyKey'] });
  const expectedActiveReleaseId = optionalReleaseId(body.expectedActiveReleaseId);
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `release:${releaseId}:stageRollback`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const target = await env.CONTENT_DB.prepare(`SELECT r.id, r.state, r.candidate_id, r.manifest_hash, r.snapshot_hash, r.snapshot_revision,
    r.build_attestation_hash, r.cloudflare_version_id FROM releases r
    WHERE r.id = ? AND EXISTS (SELECT 1 FROM deployment_receipts d WHERE d.release_id = r.id AND d.action = 'promote')`).bind(releaseId).first();
  if (!target || !['published', 'superseded'].includes(target.state)) throw new ApiError(409, 'ROLLBACK_TARGET_INVALID', 'Rollback target must be a previously promoted immutable release');
  const current = await activeReleaseId(env);
  assertExpectedActive(expectedActiveReleaseId, current);
  if (releaseId === current) throw new ApiError(409, 'ROLLBACK_TARGET_ACTIVE', 'Rollback target is already active');
  if (!target.cloudflare_version_id || !target.manifest_hash || !target.build_attestation_hash) throw new ApiError(409, 'ROLLBACK_TARGET_INCOMPLETE', 'Rollback target lacks immutable deployment bindings');
  const previousRelease = expectedActiveReleaseId ? await env.CONTENT_DB.prepare('SELECT cloudflare_version_id FROM releases WHERE id = ?').bind(expectedActiveReleaseId).first() : null;
  if (!previousRelease?.cloudflare_version_id) throw new ApiError(409, 'ROLLBACK_VERSION_UNAVAILABLE', 'The current active release lacks an immutable Cloudflare version for rollback recovery');
  const stagedAt = now();
  const transactionId = await deterministicId('deployment', { action: 'rollback', releaseId, expectedActiveReleaseId, idempotencyKey: body.idempotencyKey });
  const expiresAt = new Date(Date.parse(stagedAt) + 10 * 60 * 1000).toISOString();
  const response = { transactionId, action: 'rollback', state: 'staged', releaseId, expectedActiveReleaseId, candidateManifestHash: target.manifest_hash, buildAttestationHash: target.build_attestation_hash, previousCloudflareVersionId: previousRelease.cloudflare_version_id, cloudflareVersionId: target.cloudflare_version_id, expiresAt };
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare(`INSERT INTO release_deployment_transactions
      (id, action, state, release_id, candidate_id, submitted_snapshot_id, snapshot_hash, snapshot_revision, candidate_manifest_hash, build_attestation_hash,
       expected_active_release_id, previous_cloudflare_version_id, cloudflare_version_id, staged_by, staged_client_id, staged_run_id, created_at, expires_at)
      VALUES (?, 'rollback', 'staged', ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(transactionId, releaseId, target.manifest_hash, target.build_attestation_hash, expectedActiveReleaseId, previousRelease.cloudflare_version_id, target.cloudflare_version_id, identity.actorId, identity.clientId, identity.runId, stagedAt, expiresAt),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, stagedAt),
    await audit(env, identity, 'release.rollback.staged', 'release', releaseId, { transactionId, expectedActiveReleaseId, cloudflareVersionId: target.cloudflare_version_id }, { idempotencyHash: idem.requestHash })
  ]);
  return json(response, 201);
}

async function prepareRollbackAuthority(env, releaseId, changedAt) {
  const rows = await env.CONTENT_DB.prepare(`SELECT document_id, authority, source_path, source_revision, normalized_snapshot_hash
    FROM release_authority_entries WHERE release_id = ? ORDER BY document_id`).bind(releaseId).all();
  const entries = rows.results || [];
  if (entries.length !== 18 || new Set(entries.map((item) => item.document_id)).size !== 18) throw new ApiError(409, 'ROLLBACK_AUTHORITY_INCOMPLETE', 'Rollback target lacks a complete 18-chapter authority map');
  const statements = [];
  for (const entry of entries) {
    validId(entry.document_id, 'documentId'); validId(entry.source_revision, 'sourceRevision'); exactHash(entry.normalized_snapshot_hash, 'normalizedSnapshotHash');
    if (!['git', 'd1'].includes(entry.authority)) throw new ApiError(409, 'ROLLBACK_AUTHORITY_INVALID', 'Rollback target contains an invalid authority entry', { documentId: entry.document_id });
    if (entry.authority === 'git' && (typeof entry.source_path !== 'string' || !/^content\/chapters\/[A-Za-z0-9._/-]+\/$/.test(entry.source_path) || entry.source_path.includes('..'))) throw new ApiError(409, 'ROLLBACK_AUTHORITY_INVALID', 'Rollback target contains an invalid Git source path', { documentId: entry.document_id });
    if (entry.authority === 'd1') {
      const revision = await env.CONTENT_DB.prepare('SELECT document_id, content_hash FROM document_revisions WHERE id = ?').bind(entry.source_revision).first();
      if (revision?.document_id !== entry.document_id || revision.content_hash !== entry.normalized_snapshot_hash) throw new ApiError(409, 'ROLLBACK_REVISION_UNAVAILABLE', 'Rollback target D1 revision is missing or failed its immutable hash binding', { documentId: entry.document_id, sourceRevision: entry.source_revision });
      statements.push(env.CONTENT_DB.prepare('UPDATE documents SET current_revision_id = ?, current_content_hash = ?, updated_at = ? WHERE id = ?').bind(entry.source_revision, entry.normalized_snapshot_hash, changedAt, entry.document_id));
    }
    statements.push(env.CONTENT_DB.prepare('UPDATE authority_registry SET active = 0, valid_until = ? WHERE document_id = ? AND active = 1').bind(changedAt, entry.document_id));
    const authorityId = await deterministicId('authority', { documentId: entry.document_id, sourceRevision: entry.source_revision, normalizedSnapshotHash: entry.normalized_snapshot_hash, authority: entry.authority });
    statements.push(env.CONTENT_DB.prepare(`INSERT INTO authority_registry
      (id, document_id, authority, source_path, source_revision, normalized_snapshot_hash, active, valid_from, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(document_id, source_revision) DO UPDATE SET authority = excluded.authority,
        source_path = excluded.source_path, normalized_snapshot_hash = excluded.normalized_snapshot_hash,
        active = 1, valid_from = excluded.valid_from, valid_until = NULL`).bind(authorityId, entry.document_id, entry.authority, entry.authority === 'git' ? entry.source_path : null, entry.source_revision, entry.normalized_snapshot_hash, changedAt, changedAt));
  }
  return { entries, statements };
}

async function recordDeploymentReceipt(request, env, identity, transactionId, { allowExpired = false, reconciled = false } = {}) {
  requireReleaseWorkflowIdentity(identity);
  const body = await readJsonBody(request, { allowedFields: ['candidateManifestHash', 'buildAttestationHash', 'cloudflareDeploymentId', 'cloudflareVersionId', 'verificationHash', 'receiptHash', 'idempotencyKey'] });
  exactHash(body.candidateManifestHash, 'candidateManifestHash'); exactHash(body.buildAttestationHash, 'buildAttestationHash'); exactHash(body.verificationHash, 'verificationHash'); exactHash(body.receiptHash, 'receiptHash');
  validId(body.cloudflareDeploymentId, 'cloudflareDeploymentId'); validId(body.cloudflareVersionId, 'cloudflareVersionId');
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `release-deployment:${transactionId}:receipt`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const transaction = await env.CONTENT_DB.prepare('SELECT * FROM release_deployment_transactions WHERE id = ?').bind(transactionId).first();
  if (!transaction) throw new ApiError(404, 'DEPLOYMENT_TRANSACTION_NOT_FOUND', 'Staged deployment transaction was not found');
  if (transaction.state !== 'staged') throw new ApiError(409, 'DEPLOYMENT_TRANSACTION_CLOSED', 'Only a staged deployment can accept a receipt');
  if (!allowExpired && Date.parse(transaction.expires_at) <= Date.now()) throw new ApiError(409, 'DEPLOYMENT_TRANSACTION_EXPIRED', 'Staged deployment expired; verify live traffic through the protected reconciler');
  if (body.candidateManifestHash !== transaction.candidate_manifest_hash || body.buildAttestationHash !== transaction.build_attestation_hash || body.cloudflareVersionId !== transaction.cloudflare_version_id) {
    throw new ApiError(409, 'DEPLOYMENT_BINDING_MISMATCH', 'Deployment receipt does not match the exact staged candidate, attestation, and Cloudflare version');
  }
  assertExpectedActive(transaction.expected_active_release_id || null, await activeReleaseId(env));
  const receiptPayload = {
    transactionId, action: transaction.action, releaseId: transaction.release_id, previousActiveReleaseId: transaction.expected_active_release_id || null,
    candidateId: transaction.candidate_id || null, snapshotHash: transaction.snapshot_hash || null, snapshotRevision: transaction.snapshot_revision || null,
    candidateManifestHash: transaction.candidate_manifest_hash, buildAttestationHash: transaction.build_attestation_hash,
    cloudflareDeploymentId: body.cloudflareDeploymentId, cloudflareVersionId: body.cloudflareVersionId, verificationHash: body.verificationHash
  };
  const expectedReceiptHash = await deploymentReceiptHash(receiptPayload);
  if (body.receiptHash !== expectedReceiptHash) throw new ApiError(409, 'RECEIPT_HASH_MISMATCH', 'Deployment receipt hash does not bind the exact staged transaction and deployed version', { expectedReceiptHash });
  const recordedAt = now();
  const receiptId = await deterministicId('receipt', { transactionId, receiptHash: body.receiptHash });
  const response = { receiptId, receiptHash: body.receiptHash, transactionId, action: transaction.action, releaseId: transaction.release_id, previousActiveReleaseId: transaction.expected_active_release_id || null, activeReleaseId: transaction.release_id, cloudflareDeploymentId: body.cloudflareDeploymentId, cloudflareVersionId: body.cloudflareVersionId, reconciled, recordedAt };
  const rollbackAuthority = transaction.action === 'rollback' ? await prepareRollbackAuthority(env, transaction.release_id, recordedAt) : { entries: [], statements: [] };
  const statements = [
    env.CONTENT_DB.prepare(`INSERT INTO deployment_receipts
      (id, transaction_id, action, release_id, previous_active_release_id, candidate_id, candidate_manifest_hash, build_attestation_hash, snapshot_hash, snapshot_revision,
       cloudflare_deployment_id, cloudflare_version_id, verification_hash, receipt_hash, recorded_by, recorded_client_id, recorded_run_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(receiptId, transactionId, transaction.action, transaction.release_id, transaction.expected_active_release_id || null, transaction.candidate_id || null, transaction.candidate_manifest_hash, transaction.build_attestation_hash, transaction.snapshot_hash || null, transaction.snapshot_revision || null, body.cloudflareDeploymentId, body.cloudflareVersionId, body.verificationHash, body.receiptHash, identity.actorId, identity.clientId, identity.runId, recordedAt),
    env.CONTENT_DB.prepare("UPDATE releases SET state = 'published', published_at = COALESCE(published_at, ?) WHERE id = ?").bind(recordedAt, transaction.release_id),
    env.CONTENT_DB.prepare(`INSERT INTO release_pointer_commands
      (id, receipt_id, action, expected_active_release_id, release_id, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(await deterministicId('pointercmd', { receiptId }), receiptId, transaction.action, transaction.expected_active_release_id || null, transaction.release_id, identity.actorId, recordedAt),
    ...rollbackAuthority.statements,
    env.CONTENT_DB.prepare("UPDATE release_deployment_transactions SET state = 'completed', completed_at = ? WHERE id = ? AND state = 'staged'").bind(recordedAt, transactionId),
    env.CONTENT_DB.prepare("UPDATE releases SET state = 'superseded' WHERE id = ? AND id <> ? AND state = 'published'").bind(transaction.expected_active_release_id || '', transaction.release_id),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, recordedAt),
    await audit(env, identity, reconciled ? 'release.deployment.receipt_reconciled' : transaction.action === 'rollback' ? 'release.rollback.receipt_recorded' : 'release.deployment.receipt_recorded', 'release', transaction.release_id, { receiptId, receiptHash: body.receiptHash, transactionId, previousActiveReleaseId: transaction.expected_active_release_id || null, cloudflareDeploymentId: body.cloudflareDeploymentId, cloudflareVersionId: body.cloudflareVersionId, verificationHash: body.verificationHash, restoredAuthorityDocumentCount: rollbackAuthority.entries.length }, { idempotencyHash: idem.requestHash })
  ];
  await env.CONTENT_DB.batch(statements);
  return json(response, 201);
}

async function pendingDeploymentState(request, env, identity) {
  requireReleaseWorkflowIdentity(identity);
  await readJsonBody(request, { allowedFields: [] });
  const activeReleaseIdValue = await activeReleaseId(env);
  const transaction = await env.CONTENT_DB.prepare(`SELECT * FROM release_deployment_transactions
    WHERE state = 'staged' ORDER BY created_at ASC LIMIT 1`).first();
  const authorityReleaseId = transaction?.release_id || activeReleaseIdValue;
  const authorityRows = authorityReleaseId ? await env.CONTENT_DB.prepare(`SELECT document_id, authority, source_revision, normalized_snapshot_hash
    FROM release_authority_entries WHERE release_id = ? ORDER BY document_id`).bind(authorityReleaseId).all() : { results: [] };
  const authorityEntries = authorityRows.results || [];
  const d1Documents = authorityEntries.filter((item) => item.authority === 'd1').map((item) => ({ documentId: item.document_id, sourceRevision: item.source_revision, normalizedSnapshotHash: item.normalized_snapshot_hash }));
  const activeRelease = activeReleaseIdValue ? {
    releaseId: activeReleaseIdValue,
    ...(authorityReleaseId === activeReleaseIdValue ? { authorityDocumentCount: authorityEntries.length, d1Documents } : {})
  } : null;
  if (!transaction) return json({ pending: null, activeRelease, checkedAt: now() });
  if (authorityEntries.length !== 18) throw new ApiError(409, 'RELEASE_AUTHORITY_INCOMPLETE', 'Staged transaction release lacks its complete 18-document authority map', { releaseId: transaction.release_id, documentCount: authorityEntries.length });
  if (!transaction.previous_cloudflare_version_id || transaction.previous_cloudflare_version_id === transaction.cloudflare_version_id) throw new ApiError(409, 'DEPLOYMENT_RECOVERY_BINDING_MISSING', 'Staged transaction lacks distinct target and recovery Cloudflare versions');
  return json({
    pending: {
      transactionId: transaction.id, action: transaction.action, state: transaction.state, releaseId: transaction.release_id,
      candidateId: transaction.candidate_id || null, snapshotHash: transaction.snapshot_hash || null, snapshotRevision: transaction.snapshot_revision || null,
      candidateManifestHash: transaction.candidate_manifest_hash, buildAttestationHash: transaction.build_attestation_hash,
      expectedActiveReleaseId: transaction.expected_active_release_id || null, previousCloudflareVersionId: transaction.previous_cloudflare_version_id,
      cloudflareVersionId: transaction.cloudflare_version_id, authorityDocumentCount: authorityEntries.length, d1Documents,
      expiresAt: transaction.expires_at, expired: Date.parse(transaction.expires_at) <= Date.now()
    },
    activeRelease,
    checkedAt: now()
  });
}

async function abandonDeployment(request, env, identity, transactionId) {
  requireReleaseWorkflowIdentity(identity);
  const body = await readJsonBody(request, { allowedFields: ['observedCloudflareVersionId', 'verificationHash', 'idempotencyKey'] });
  validId(body.observedCloudflareVersionId, 'observedCloudflareVersionId'); exactHash(body.verificationHash, 'verificationHash');
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `release-deployment:${transactionId}:abandon`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const transaction = await env.CONTENT_DB.prepare('SELECT * FROM release_deployment_transactions WHERE id = ?').bind(transactionId).first();
  if (!transaction) throw new ApiError(404, 'DEPLOYMENT_TRANSACTION_NOT_FOUND', 'Staged deployment transaction was not found');
  if (transaction.state !== 'staged') throw new ApiError(409, 'DEPLOYMENT_TRANSACTION_CLOSED', 'Only a staged deployment can be abandoned');
  assertExpectedActive(transaction.expected_active_release_id || null, await activeReleaseId(env));
  if (!transaction.previous_cloudflare_version_id || body.observedCloudflareVersionId !== transaction.previous_cloudflare_version_id || body.observedCloudflareVersionId === transaction.cloudflare_version_id) {
    throw new ApiError(409, 'DEPLOYMENT_LIVE_VERSION_AMBIGUOUS', 'Staged deployment can be abandoned only when traffic is still entirely on its exact recorded recovery version');
  }
  const abandonedAt = now();
  const response = { transactionId, action: transaction.action, state: 'abandoned', releaseId: transaction.release_id, observedCloudflareVersionId: body.observedCloudflareVersionId, verificationHash: body.verificationHash, abandonedAt };
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare("UPDATE release_deployment_transactions SET state = 'abandoned', completed_at = ? WHERE id = ? AND state = 'staged'").bind(abandonedAt, transactionId),
    env.CONTENT_DB.prepare("UPDATE releases SET state = 'failed' WHERE id = ? AND state = 'building'").bind(transaction.release_id),
    idempotencyStatement(env, idem, body.idempotencyKey, 200, response, abandonedAt),
    await audit(env, identity, 'release.deployment.abandoned_verified', 'release', transaction.release_id, { transactionId, action: transaction.action, observedCloudflareVersionId: body.observedCloudflareVersionId, verificationHash: body.verificationHash }, { idempotencyHash: idem.requestHash })
  ]);
  return json(response);
}

async function verifiedLiveSaveLineage(env, documentId, releaseRevisionId, currentRevisionId) {
  if (!releaseRevisionId || !currentRevisionId || releaseRevisionId === currentRevisionId) return null;
  const rows = await env.CONTENT_DB.prepare(`WITH RECURSIVE lineage(id, parent_revision_id, content_hash, metadata_json, depth) AS (
      SELECT id, parent_revision_id, content_hash, metadata_json, 0 FROM document_revisions WHERE id = ? AND document_id = ?
      UNION ALL
      SELECT parent.id, parent.parent_revision_id, parent.content_hash, parent.metadata_json, lineage.depth + 1
      FROM document_revisions parent JOIN lineage ON parent.id = lineage.parent_revision_id
      WHERE lineage.id <> ? AND parent.document_id = ? AND lineage.depth < 100
    ) SELECT id, parent_revision_id, content_hash, metadata_json, depth FROM lineage ORDER BY depth`)
    .bind(currentRevisionId, documentId, releaseRevisionId, documentId).all();
  const lineage = rows.results || [];
  const releaseIndex = lineage.findIndex((item) => item.id === releaseRevisionId);
  if (releaseIndex < 1) return null;
  for (const revision of lineage.slice(0, releaseIndex)) {
    let metadata;
    try { metadata = JSON.parse(revision.metadata_json || '{}'); } catch { return null; }
    if (metadata.publicationMode !== 'instructor-live-save' || metadata.status !== 'published') return null;
  }
  return { revisionCount: releaseIndex, currentRevisionId, currentContentHash: lineage[0].content_hash };
}

async function auditReleaseState(request, env, identity, releaseId) {
  requireAuthorityWorkflowIdentity(identity);
  await readJsonBody(request, { allowedFields: [] });
  const checkedAt = now();
  const release = await env.CONTENT_DB.prepare('SELECT id, state, cloudflare_version_id FROM releases WHERE id = ?').bind(releaseId).first();
  const pointer = await env.CONTENT_DB.prepare("SELECT release_id FROM release_pointers WHERE name = 'active'").first();
  const expectedRows = await env.CONTENT_DB.prepare(`SELECT document_id, authority, source_path, source_revision, normalized_snapshot_hash
    FROM release_authority_entries WHERE release_id = ? ORDER BY document_id`).bind(releaseId).all();
  const activeRows = await env.CONTENT_DB.prepare(`SELECT a.document_id, a.authority, a.source_path, a.source_revision, a.normalized_snapshot_hash,
      d.current_revision_id, d.current_content_hash
    FROM authority_registry a JOIN documents d ON d.id = a.document_id
    WHERE a.active = 1 ORDER BY a.document_id`).all();
  const expected = expectedRows.results || [];
  const active = activeRows.results || [];
  const expectedById = new Map(expected.map((item) => [item.document_id, item]));
  const activeById = new Map(active.map((item) => [item.document_id, item]));
  const mismatches = [];
  const liveAdvances = [];
  const mismatch = (kind, documentId = null, expectedValue = null, actualValue = null) => mismatches.push({ kind, documentId, expected: expectedValue, actual: actualValue });
  if (!release) mismatch('release_missing', null, releaseId, null);
  else {
    if (release.state !== 'published') mismatch('release_state', null, 'published', release.state);
    if (!release.cloudflare_version_id) mismatch('cloudflare_version_missing', null, 'immutable-version-id', null);
  }
  if (pointer?.release_id !== releaseId) mismatch('active_pointer', null, releaseId, pointer?.release_id || null);
  if (expected.length !== 18 || expectedById.size !== 18) mismatch('release_authority_count', null, 18, expected.length);
  if (active.length !== 18 || activeById.size !== 18) mismatch('active_authority_count', null, 18, active.length);
  for (const [documentId, entry] of expectedById) {
    const current = activeById.get(documentId);
    if (!current) { mismatch('authority_missing', documentId, 'active', null); continue; }
    for (const field of ['authority', 'normalized_snapshot_hash']) {
      if ((entry[field] ?? null) !== (current[field] ?? null)) mismatch(field, documentId, entry[field] ?? null, current[field] ?? null);
    }
    if (entry.authority === 'd1') {
      for (const field of ['source_path', 'source_revision']) {
        if ((entry[field] ?? null) !== (current[field] ?? null)) mismatch(field, documentId, entry[field] ?? null, current[field] ?? null);
      }
      const exactReleaseHead = current.current_revision_id === entry.source_revision && current.current_content_hash === entry.normalized_snapshot_hash;
      if (!exactReleaseHead) {
        const liveAdvance = await verifiedLiveSaveLineage(env, documentId, entry.source_revision, current.current_revision_id);
        if (liveAdvance && liveAdvance.currentContentHash === current.current_content_hash) liveAdvances.push({ documentId, ...liveAdvance });
        else {
          if (current.current_revision_id !== entry.source_revision) mismatch('canonical_revision', documentId, entry.source_revision, current.current_revision_id || null);
          if (current.current_content_hash !== entry.normalized_snapshot_hash) mismatch('canonical_hash', documentId, entry.normalized_snapshot_hash, current.current_content_hash || null);
        }
      }
    } else if (entry.authority === 'git') {
      // The release contract addresses a chapter bundle directory while the
      // authoring registry addresses its canonical chapter.md file. Git
      // provenance may likewise be a commit ID rather than the normalized
      // chapter digest. The authority and normalized content hash above are
      // the cross-representation integrity boundary.
      const expectedPath = entry.source_path;
      const actualPath = current.source_path;
      if (typeof expectedPath !== 'string' || (actualPath !== expectedPath && actualPath !== `${expectedPath}chapter.md`)) mismatch('source_path', documentId, `${expectedPath}[chapter.md]`, actualPath ?? null);
      if (typeof current.source_revision !== 'string' || !current.source_revision) mismatch('source_revision_missing', documentId, 'git-provenance-id', current.source_revision ?? null);
    }
  }
  for (const documentId of activeById.keys()) if (!expectedById.has(documentId)) mismatch('unexpected_active_authority', documentId, null, 'active');
  const details = { releaseId, expectedCloudflareVersionId: release?.cloudflare_version_id || null, documentCount: expectedById.size, liveAdvances, checkedAt };
  if (mismatches.length) throw new ApiError(409, 'RELEASE_STATE_MISMATCH', 'Active release pointer, authority map, or canonical D1 heads do not match the immutable release', { ...details, mismatchCount: mismatches.length, mismatches });
  return json({ valid: true, ...details });
}

async function createMediaReviewPackage(request, env, identity) {
  if (!identity.scopes.has('media:upload') && !identity.scopes.has('content:write')) throw new ApiError(403, 'FORBIDDEN', 'Scope media:upload or content:write is required');
  runIdentity(identity);
  const body = await readJsonBody(request, { maxBytes: 65536 });
  const declarations = validateMediaReviewPackage(body);
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, 'media-review-packages:create', body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const packageId = await deterministicId('reviewpkg', { actorId: identity.actorId, clientId: identity.clientId, runId: identity.runId, idempotencyKey: body.idempotencyKey, declarations });
  const declarationHash = await sha256(declarations);
  const rightsReviewId = await deterministicId('rightsreview', { packageId });
  const editorialReviewId = await deterministicId('editorialreview', { packageId });
  const accessibilityReviewId = await deterministicId('accessibilityreview', { packageId });
  const createdAt = now();
  const response = { id: packageId, state: 'pending', declarationHash, rightsReviewId, editorialReviewId, accessibilityReviewId, declarations, createdAt };
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare(`INSERT INTO media_review_packages
      (id, rights_review_id, editorial_review_id, accessibility_review_id, declaration_hash, state, rights_json, editorial_json, accessibility_json,
       created_by, created_actor_type, created_client_id, created_run_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(packageId, rightsReviewId, editorialReviewId, accessibilityReviewId, declarationHash, stableStringify(declarations.rights), stableStringify(declarations.editorial), stableStringify(declarations.accessibility), identity.actorId, identity.actorType, identity.clientId, identity.runId, createdAt, createdAt),
    idempotencyStatement(env, idem, body.idempotencyKey, 201, response, createdAt),
    await audit(env, identity, 'media.review_package.created', 'media_review_package', packageId, { rightsReviewId, editorialReviewId, accessibilityReviewId, state: 'pending' }, { idempotencyHash: idem.requestHash })
  ]);
  return json(response, 201);
}

async function decideMediaReviewPackage(request, env, identity, packageId) {
  requireScope(identity, 'content:approve'); runIdentity(identity); requireHumanIdentity(identity, 'Media review decision');
  const body = await readJsonBody(request, { allowedFields: ['declarationHash', 'decision', 'comment', 'idempotencyKey'] });
  if (!/^[a-f0-9]{64}$/.test(body.declarationHash || '')) throw new ApiError(422, 'HASH_INVALID', 'declarationHash must be exact lowercase SHA-256');
  if (!['cleared', 'blocked'].includes(body.decision)) throw new ApiError(422, 'REVIEW_DECISION_INVALID', 'decision must be cleared or blocked');
  if (typeof body.comment !== 'string' || !body.comment.trim() || body.comment.length > 2000) throw new ApiError(422, 'APPROVAL_COMMENT_REQUIRED', 'comment is required and must be at most 2000 characters');
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, `media-review-package:${packageId}:decide`, body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const reviewPackage = await env.CONTENT_DB.prepare('SELECT * FROM media_review_packages WHERE id = ?').bind(packageId).first();
  if (!reviewPackage) throw new ApiError(404, 'NOT_FOUND', 'Media review package was not found');
  if (reviewPackage.state !== 'pending') throw new ApiError(409, 'REVIEW_PACKAGE_NOT_PENDING', 'Only a pending media review package can be approved');
  if (reviewPackage.declaration_hash !== body.declarationHash) throw new ApiError(409, 'REVISION_CONFLICT', 'Decision must bind the exact persisted declaration hash', { declarationHash: reviewPackage.declaration_hash });
  const decidedAt = now();
  const packageState = body.decision === 'cleared' ? 'cleared' : 'rejected';
  const rightsState = body.decision === 'cleared' ? 'cleared' : 'blocked';
  const response = { id: packageId, declarationHash: body.declarationHash, state: packageState, decision: body.decision, decidedBy: identity.actorId, comment: body.comment.trim(), decidedAt };
  const batch = await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare("UPDATE media_review_packages SET state = ?, decided_by = ?, decision_comment = ?, decided_at = ?, updated_at = ? WHERE id = ? AND state = 'pending' AND declaration_hash = ?").bind(packageState, identity.actorId, body.comment.trim(), decidedAt, decidedAt, packageId, body.declarationHash),
    env.CONTENT_DB.prepare("UPDATE media_rights_cases SET status = ? WHERE review_package_id = ? AND status = 'reviewRequired'").bind(rightsState, packageId),
    idempotencyStatement(env, idem, body.idempotencyKey, 200, response, decidedAt),
    await audit(env, identity, 'media.review_package.decided', 'media_review_package', packageId, { declarationHash: body.declarationHash, decision: body.decision, state: packageState, comment: body.comment.trim() }, { idempotencyHash: idem.requestHash })
  ]);
  if (batch[0]?.meta?.changes === 0) throw new ApiError(409, 'REVIEW_PACKAGE_NOT_PENDING', 'Media review package was concurrently decided');
  return json(response);
}

async function requestMediaUpload(request, env, identity) {
  requireScope(identity, 'media:upload'); runIdentity(identity);
  requireMediaBindings(env, ['CONTENT_DB', 'UPLOAD_QUARANTINE', 'CONTENT_MEDIA', 'MEDIA_JOB_ENVELOPES', 'MEDIA_JOBS']);
  const body = await readJsonBody(request, { maxBytes: 32768 });
  const upload = validateUploadRequest(body);
  await enforceRateLimit(env, identity, 'upload');
  const reviewPackage = await env.CONTENT_DB.prepare(`SELECT id, state, rights_review_id, editorial_review_id, accessibility_review_id, accessibility_json
    FROM media_review_packages WHERE id = ?`).bind(upload.reviewPackageId).first();
  if (!reviewPackage) throw new ApiError(422, 'REVIEW_PACKAGE_NOT_FOUND', 'reviewPackageId does not reference a persisted server review package');
  if (!['pending', 'cleared'].includes(reviewPackage.state)) throw new ApiError(409, 'REVIEW_PACKAGE_REJECTED', 'Rejected review package cannot be used for upload');
  const accessibility = parseStoredJson(reviewPackage.accessibility_json, 'Accessibility declaration');
  if (upload.transcriptEquivalent && stableStringify(accessibility.transcriptEquivalent) !== stableStringify({ language: upload.transcriptEquivalent.language.trim(), text: upload.transcriptEquivalent.text.trim() })) throw new ApiError(422, 'TRANSCRIPT_EQUIVALENT_MISMATCH', 'Upload transcript/equivalent must exactly match the persisted accessibility declaration');
  const idem = await beginIdempotency(env, identity, 'media:requestUpload', body.idempotencyKey, body);
  if (idem.replay) return idem.replay;
  const createdAt = now();
  const monthKey = createdAt.slice(0, 7);
  await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare("INSERT OR IGNORE INTO media_budget_global (id, updated_at) VALUES ('global', ?)").bind(createdAt),
    env.CONTENT_DB.prepare('INSERT OR IGNORE INTO media_budget_monthly (month_key, updated_at) VALUES (?, ?)').bind(monthKey, createdAt)
  ]);
  const globalBudget = await env.CONTENT_DB.prepare("SELECT stored_bytes, reserved_bytes FROM media_budget_global WHERE id = 'global'").first();
  const monthlyBudget = await env.CONTENT_DB.prepare('SELECT ingested_bytes, reserved_bytes FROM media_budget_monthly WHERE month_key = ?').bind(monthKey).first();
  assertMediaBudget({ storedBytes: globalBudget.stored_bytes, reservedStorageBytes: globalBudget.reserved_bytes, monthlyIngestedBytes: monthlyBudget.ingested_bytes, monthlyReservedBytes: monthlyBudget.reserved_bytes }, upload);
  const ticketId = await deterministicId('upload', { actorId: identity.actorId, idempotencyKey: body.idempotencyKey, sha256: upload.sha256 });
  const jobId = await deterministicId('mediajob', { ticketId, sha256: upload.sha256 });
  const uploadToken = randomHex();
  const tokenHash = await sha256(uploadToken);
  const objectKey = `quarantine/${ticketId}/${upload.filename}`;
  const expiresAt = new Date(Date.parse(createdAt) + MEDIA_UPLOAD_POLICY.ticketTtlSeconds * 1000).toISOString();
  const response = { ticketId, jobId, state: 'issued', reviewPackageId: reviewPackage.id, reviewState: reviewPackage.state, expiresAt, maxBytes: upload.maxBytes, upload: { method: 'PUT', path: `/v1/media/uploads/${ticketId}`, token: uploadToken, requiredHeaders: { 'content-type': upload.mimeType, 'content-length': String(upload.bytes), 'x-content-sha256': upload.sha256, 'x-upload-token': uploadToken } } };
  try {
    await env.CONTENT_DB.batch([
      env.CONTENT_DB.prepare("UPDATE media_budget_global SET reserved_bytes = reserved_bytes + ?, updated_at = ? WHERE id = 'global'").bind(upload.storageReservationBytes, createdAt),
      env.CONTENT_DB.prepare('UPDATE media_budget_monthly SET reserved_bytes = reserved_bytes + ?, updated_at = ? WHERE month_key = ?').bind(upload.bytes, createdAt, monthKey),
      env.CONTENT_DB.prepare(`INSERT INTO upload_tickets
        (id, object_key, content_type, content_hash, max_bytes, state, issued_by, expires_at, created_at, filename, declared_bytes, upload_token_hash, month_key, storage_reservation_bytes, job_id, request_json, review_package_id)
        VALUES (?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(ticketId, objectKey, upload.mimeType, upload.sha256, upload.maxBytes, identity.actorId, expiresAt, createdAt, upload.filename, upload.bytes, tokenHash, monthKey, upload.storageReservationBytes, jobId, JSON.stringify({ transcriptEquivalent: upload.transcriptEquivalent || null, poster: upload.poster || null, reviews: { reviewPackageId: reviewPackage.id, rightsReviewId: reviewPackage.rights_review_id, editorialReviewId: reviewPackage.editorial_review_id, accessibilityReviewId: reviewPackage.accessibility_review_id } }), reviewPackage.id),
      env.CONTENT_DB.prepare("INSERT INTO media_jobs (id, upload_ticket_id, state, created_by, created_at, updated_at) VALUES (?, ?, 'awaiting_upload', ?, ?, ?)").bind(jobId, ticketId, identity.actorId, createdAt, createdAt),
      idempotencyStatement(env, idem, body.idempotencyKey, 201, response, createdAt),
      await audit(env, identity, 'media.upload.requested', 'media_job', jobId, { ticketId, filename: upload.filename, mimeType: upload.mimeType, declaredBytes: upload.bytes, storageReservationBytes: upload.storageReservationBytes }, { idempotencyHash: idem.requestHash })
    ]);
  } catch (error) {
    if (/CHECK constraint failed/i.test(error?.message || '')) throw new ApiError(429, 'MEDIA_BUDGET_EXCEEDED', 'Media budget reservation was rejected');
    throw error;
  }
  return json(response, 201);
}

async function uploadMediaBytes(request, env, identity, ticketId) {
  requireScope(identity, 'media:upload'); runIdentity(identity);
  requireMediaBindings(env, ['CONTENT_DB', 'UPLOAD_QUARANTINE', 'CONTENT_MEDIA', 'MEDIA_JOB_ENVELOPES', 'MEDIA_JOBS']);
  await enforceRateLimit(env, identity, 'upload');
  const ticket = await env.CONTENT_DB.prepare(`SELECT t.*, j.id AS media_job_id, j.state AS job_state FROM upload_tickets t
    JOIN media_jobs j ON j.upload_ticket_id = t.id WHERE t.id = ?`).bind(ticketId).first();
  if (!ticket) throw new ApiError(404, 'NOT_FOUND', 'Upload ticket was not found');
  if (ticket.issued_by !== identity.actorId) throw new ApiError(403, 'FORBIDDEN', 'Upload ticket belongs to another actor');
  if (ticket.state !== 'issued' || ticket.job_state !== 'awaiting_upload') throw new ApiError(409, 'UPLOAD_TICKET_USED', 'Upload ticket is no longer available');
  if (Date.parse(ticket.expires_at) <= Date.now()) throw new ApiError(410, 'UPLOAD_TICKET_EXPIRED', 'Upload ticket has expired');
  const token = request.headers.get('x-upload-token');
  if (!token || await sha256(token) !== ticket.upload_token_hash) throw new ApiError(401, 'UPLOAD_TOKEN_INVALID', 'One-time upload token is invalid');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== ticket.content_type) throw new ApiError(415, 'MIME_MISMATCH', 'Content-Type does not match the upload ticket');
  if (request.headers.get('x-content-sha256') !== ticket.content_hash) throw new ApiError(422, 'HASH_MISMATCH', 'Declared SHA-256 does not match the upload ticket');
  const declaredLength = Number(request.headers.get('content-length'));
  if (!Number.isInteger(declaredLength) || declaredLength !== ticket.declared_bytes || declaredLength > ticket.max_bytes) throw new ApiError(413, 'SIZE_MISMATCH', 'Content-Length does not match the bounded upload ticket');
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength !== ticket.declared_bytes || bytes.byteLength > ticket.max_bytes) throw new ApiError(413, 'SIZE_MISMATCH', 'Uploaded byte count does not match the ticket');
  const actualHash = await sha256Bytes(bytes);
  if (actualHash !== ticket.content_hash) throw new ApiError(422, 'HASH_MISMATCH', 'Uploaded bytes failed SHA-256 verification');
  if (await env.UPLOAD_QUARANTINE.head(ticket.object_key)) throw new ApiError(409, 'QUARANTINE_OBJECT_EXISTS', 'Immutable quarantine key already exists');
  await env.UPLOAD_QUARANTINE.put(ticket.object_key, bytes, { httpMetadata: { contentType: ticket.content_type }, customMetadata: { sha256: actualHash, ticketId } });
  const uploadedAt = now();
  const uploadRequest = parseStoredJson(ticket.request_json, 'Upload request metadata');
  const envelope = {
    schemaVersion: 1, jobId: ticket.media_job_id, basename: ticket.filename,
    quarantineObjectKey: ticket.object_key, expectedSource: { sha256: actualHash, bytes: bytes.byteLength, mimeType: ticket.content_type, storageReservationBytes: ticket.storage_reservation_bytes },
    outputPrefix: `media/${ticket.media_job_id}`, callback: { url: env.MEDIA_CALLBACK_URL, tokenRef: 'MEDIA_CALLBACK_TOKEN' },
    rights: { required: true, reviewId: uploadRequest.reviews.rightsReviewId }, editorial: { required: true, reviewId: uploadRequest.reviews.editorialReviewId }, accessibility: { required: true, reviewId: uploadRequest.reviews.accessibilityReviewId },
    ...(uploadRequest.transcriptEquivalent ? { captions: { provided: true, language: uploadRequest.transcriptEquivalent.language, transcriptEquivalent: uploadRequest.transcriptEquivalent.text, declarationKind: 'transcript-equivalent-not-timed-captions' } } : {}), ...(uploadRequest.poster ? { poster: uploadRequest.poster } : {})
  };
  const envelopeJson = stableStringify(envelope);
  const envelopeHash = await sha256(envelopeJson);
  const envelopeKey = `jobs/${ticket.media_job_id}/${envelopeHash}.json`;
  if (await env.MEDIA_JOB_ENVELOPES.head(envelopeKey)) throw new ApiError(409, 'JOB_ENVELOPE_EXISTS', 'Immutable job envelope key already exists');
  await env.MEDIA_JOB_ENVELOPES.put(envelopeKey, envelopeJson, { httpMetadata: { contentType: 'application/json' }, customMetadata: { sha256: envelopeHash, jobId: ticket.media_job_id } });
  await env.MEDIA_JOBS.send({ schemaVersion: 1, jobId: ticket.media_job_id, envelopeObjectKey: envelopeKey, envelopeSha256: envelopeHash });
  const processorIdentity = { ...identity, runId: identity.runId || ticket.media_job_id };
  const batch = await env.CONTENT_DB.batch([
    env.CONTENT_DB.prepare("UPDATE upload_tickets SET state = 'uploaded', uploaded_bytes = ? WHERE id = ? AND state = 'issued'").bind(bytes.byteLength, ticketId),
    env.CONTENT_DB.prepare("UPDATE media_jobs SET state = 'queued', envelope_object_key = ?, envelope_hash = ?, updated_at = ? WHERE id = ? AND state = 'awaiting_upload'").bind(envelopeKey, envelopeHash, uploadedAt, ticket.media_job_id),
    env.CONTENT_DB.prepare('UPDATE media_budget_monthly SET reserved_bytes = reserved_bytes - ?, ingested_bytes = ingested_bytes + ?, updated_at = ? WHERE month_key = ?').bind(bytes.byteLength, bytes.byteLength, uploadedAt, ticket.month_key),
    await audit(env, processorIdentity, 'media.upload.quarantined', 'media_job', ticket.media_job_id, { ticketId, quarantineObjectKey: ticket.object_key, envelopeKey, envelopeHash, bytes: bytes.byteLength })
  ]);
  if (batch[0]?.meta?.changes === 0 || batch[1]?.meta?.changes === 0) throw new ApiError(409, 'UPLOAD_TICKET_USED', 'Upload ticket was concurrently consumed');
  return json({ ticketId, jobId: ticket.media_job_id, state: 'queued', sha256: actualHash, envelope: { objectKey: envelopeKey, sha256: envelopeHash } }, 202);
}

async function getMediaJob(env, jobId) {
  const row = await env.CONTENT_DB.prepare(`SELECT j.id, j.state, j.envelope_hash, j.manifest_object_key, j.error_code, j.created_at, j.updated_at, j.completed_at,
    t.filename, t.content_type, t.declared_bytes, t.content_hash FROM media_jobs j JOIN upload_tickets t ON t.id = j.upload_ticket_id WHERE j.id = ?`).bind(jobId).first();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Media job was not found');
  const version = row.state === 'ready' ? await env.CONTENT_DB.prepare(`SELECT v.id AS media_version_id, v.media_id, r.id AS rights_case_id, r.status AS rights_status
    FROM media_asset_versions v JOIN media_rights_cases r ON r.media_version_id = v.id WHERE v.manifest_object_key = ? LIMIT 1`).bind(row.manifest_object_key).first() : null;
  return json({ ...row, ...(version || {}) });
}

async function getMediaAsset(env, mediaId) {
  const asset = await env.CONTENT_DB.prepare('SELECT * FROM media_assets WHERE id = ?').bind(mediaId).first();
  if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Media asset was not found');
  const versions = await env.CONTENT_DB.prepare(`SELECT v.id, v.source_sha256, v.source_bytes, v.detected_mime, v.immutable_address, v.manifest_object_key,
    v.technical_json, v.derivatives_json, v.processor_version, v.created_at, r.id AS rights_case_id, r.status AS rights_status
    FROM media_asset_versions v LEFT JOIN media_rights_cases r ON r.media_version_id = v.id WHERE v.media_id = ? ORDER BY v.created_at DESC`).bind(mediaId).all();
  return json({ ...asset, versions: (versions.results || []).map((item) => ({ ...item, technical: parseStoredJson(item.technical_json, 'Media technical metadata'), derivatives: parseStoredJson(item.derivatives_json, 'Media derivatives'), technical_json: undefined, derivatives_json: undefined })) });
}

async function searchMedia(env, url) {
  const { limit, cursor } = pageParams(url, { defaultLimit: 20, maxLimit: 50, maxCursor: 10000 });
  const q = boundedQuery(url.searchParams.get('q'), 'q', 100);
  const kind = boundedQuery(url.searchParams.get('kind'), 'kind', 20);
  const rightsStatus = boundedQuery(url.searchParams.get('rightsStatus'), 'rightsStatus', 30);
  const sourceSha256 = boundedQuery(url.searchParams.get('sha256'), 'sha256', 64);
  if (kind && !['image', 'audio', 'video', 'document'].includes(kind)) throw new ApiError(400, 'MEDIA_KIND_INVALID', 'kind must be image, audio, video, or document');
  if (rightsStatus && !['reviewRequired', 'cleared', 'blocked'].includes(rightsStatus)) throw new ApiError(400, 'RIGHTS_STATUS_INVALID', 'rightsStatus is invalid');
  if (sourceSha256 && !/^[a-f0-9]{64}$/.test(sourceSha256)) throw new ApiError(400, 'HASH_INVALID', 'sha256 must be exact lowercase SHA-256');
  const clauses = ["a.state = 'ready'"];
  const args = [];
  if (q) {
    const like = `%${q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push("(LOWER(a.title) LIKE ? ESCAPE '\\' OR v.source_sha256 = ?)"); args.push(like, q.toLowerCase());
  }
  if (kind) {
    const mimePredicate = kind === 'document' ? "v.detected_mime IN ('application/pdf', 'text/plain')" : 'v.detected_mime LIKE ?';
    clauses.push(mimePredicate); if (kind !== 'document') args.push(`${kind}/%`);
  }
  if (rightsStatus) { clauses.push('r.status = ?'); args.push(rightsStatus); }
  if (sourceSha256) { clauses.push('v.source_sha256 = ?'); args.push(sourceSha256); }
  const rows = await env.CONTENT_DB.prepare(`SELECT a.id, a.title, a.state, a.updated_at, v.id AS media_version_id,
    v.source_sha256, v.source_bytes, v.detected_mime, v.immutable_address, v.created_at AS version_created_at,
    r.id AS rights_case_id, r.status AS rights_status
    FROM media_assets a JOIN media_asset_versions v ON v.id = (
      SELECT vx.id FROM media_asset_versions vx WHERE vx.media_id = a.id ORDER BY vx.created_at DESC, vx.id DESC LIMIT 1
    ) LEFT JOIN media_rights_cases r ON r.rowid = (
      SELECT rx.rowid FROM media_rights_cases rx WHERE rx.media_version_id = v.id ORDER BY rx.created_at DESC, rx.id DESC LIMIT 1
    ) WHERE ${clauses.join(' AND ')} ORDER BY a.updated_at DESC, a.id ASC LIMIT ? OFFSET ?`).bind(...args, limit + 1, cursor).all();
  const items = [...(rows.results || [])];
  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  return json({ media: items, filters: { q: q || null, kind: kind || null, rightsStatus: rightsStatus || null, sha256: sourceSha256 || null }, page: { limit, cursor: String(cursor), nextCursor: hasMore ? String(cursor + items.length) : null } });
}

async function resolveEmbed(request, identity) {
  requireScope(identity, 'content:write'); runIdentity(identity);
  const body = await readJsonBody(request, { maxBytes: 8192, allowedFields: ['url', 'expectedProvider'] });
  if (typeof body.url !== 'string' || !body.url.trim()) throw new ApiError(422, 'VALIDATION_FAILED', 'url is required');
  if (body.expectedProvider !== undefined && typeof body.expectedProvider !== 'string') throw new ApiError(422, 'VALIDATION_FAILED', 'expectedProvider must be a string');
  return json({ proposal: resolveProviderUrl(body.url.trim(), body.expectedProvider) });
}

async function getReleaseSnapshot(env, identity, snapshotHash) {
  requireScope(identity, 'content:releaseSnapshot');
  if (!/^[a-f0-9]{64}$/.test(snapshotHash)) throw new ApiError(422, 'HASH_INVALID', 'Snapshot hash must be exact lowercase SHA-256');
  if (!env.CONTENT_DB || !env.CONTENT_SNAPSHOTS) throw new ApiError(503, 'SNAPSHOT_STORE_UNAVAILABLE', 'Snapshot metadata or storage is unavailable');
  const approved = await env.CONTENT_DB.prepare(`SELECT s.r2_object_key, s.snapshot_revision FROM submitted_snapshots s JOIN approvals a
    ON a.changeset_id = s.changeset_id AND a.submitted_snapshot_hash = s.snapshot_hash AND a.submitted_snapshot_revision = s.snapshot_revision
    WHERE s.snapshot_hash = ? AND a.decision_kind = 'release' AND a.decision = 'approved' LIMIT 1`).bind(snapshotHash).first();
  if (!approved) throw new ApiError(403, 'RELEASE_APPROVAL_REQUIRED', 'Exact submitted snapshot lacks human release approval');
  const objectKey = approved.r2_object_key;
  if (objectKey !== `submitted/${snapshotHash}.json`) throw new ApiError(500, 'SNAPSHOT_KEY_MISMATCH', 'Approved snapshot metadata does not use its exact immutable hash key');
  if (typeof approved.snapshot_revision !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(approved.snapshot_revision)) throw new ApiError(500, 'SNAPSHOT_REVISION_INVALID', 'Approved snapshot revision metadata is invalid');
  const object = await env.CONTENT_SNAPSHOTS.get(objectKey);
  if (!object) throw new ApiError(404, 'NOT_FOUND', 'Submitted snapshot was not found');
  const bytes = await object.arrayBuffer();
  if (await sha256Bytes(bytes) !== snapshotHash) throw new ApiError(500, 'SNAPSHOT_HASH_MISMATCH', 'Stored snapshot bytes failed integrity verification');
  return new Response(bytes, { headers: { ...JSON_HEADERS, 'cache-control': 'private, no-store', 'content-disposition': `attachment; filename="submitted-${snapshotHash}.json"`, 'x-content-sha256': snapshotHash, 'x-content-snapshot-revision': approved.snapshot_revision } });
}

async function getReleaseAsset(env, identity, assetHash) {
  requireScope(identity, 'content:releaseSnapshot');
  if (!/^[a-f0-9]{64}$/.test(assetHash)) throw new ApiError(422, 'HASH_INVALID', 'Release asset hash must be exact lowercase SHA-256');
  if (!env.CONTENT_DB || !env.CONTENT_MEDIA) throw new ApiError(503, 'MEDIA_BINDING_UNAVAILABLE', 'Release asset metadata or storage is unavailable');
  const asset = await env.CONTENT_DB.prepare(`SELECT ma.object_key, ma.object_sha256, ma.object_bytes, ma.content_type, ma.role
    FROM submitted_snapshot_media_assets ma JOIN submitted_snapshots s ON s.id = ma.snapshot_id JOIN approvals a
    ON a.changeset_id = s.changeset_id AND a.submitted_snapshot_hash = s.snapshot_hash AND a.submitted_snapshot_revision = s.snapshot_revision
    WHERE ma.object_sha256 = ? AND a.decision_kind = 'release' AND a.decision = 'approved' ORDER BY s.created_at DESC LIMIT 1`).bind(assetHash).first();
  if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Approved release asset was not found');
  if (asset.object_sha256 !== assetHash || !asset.object_key?.startsWith('media/') || asset.object_key.includes('..') || !Number.isInteger(asset.object_bytes) || asset.object_bytes < 1) throw new ApiError(500, 'MEDIA_OBJECT_METADATA_INVALID', 'Approved release asset metadata is invalid');
  const object = await env.CONTENT_MEDIA.get(asset.object_key);
  if (!object) throw new ApiError(503, 'DERIVATIVE_UNAVAILABLE', 'Approved immutable release asset is unavailable');
  if (Number.isFinite(object.size) && object.size !== asset.object_bytes) throw new ApiError(500, 'MEDIA_OBJECT_SIZE_MISMATCH', 'Stored release asset size does not match approved metadata');
  if (object.customMetadata?.sha256 && object.customMetadata.sha256 !== assetHash) throw new ApiError(500, 'MEDIA_OBJECT_HASH_MISMATCH', 'Stored release asset metadata hash does not match approval');
  const bytes = await object.arrayBuffer();
  if (bytes.byteLength !== asset.object_bytes) throw new ApiError(500, 'MEDIA_OBJECT_SIZE_MISMATCH', 'Stored release asset bytes do not match approved metadata');
  if (await sha256Bytes(bytes) !== assetHash) throw new ApiError(500, 'MEDIA_OBJECT_HASH_MISMATCH', 'Stored release asset bytes failed approved SHA-256 verification');
  return new Response(bytes, { headers: { 'content-type': asset.content_type, 'cache-control': 'private, no-store', 'content-disposition': `attachment; filename="${assetHash}"`, 'x-content-sha256': assetHash, 'x-content-media-role': asset.role, 'x-content-type-options': 'nosniff' } });
}

async function getRelease(env, releaseId) {
  const release = await env.CONTENT_DB.prepare(`SELECT r.*, s.id AS snapshot_id, s.snapshot_hash, s.snapshot_revision,
    s.r2_object_key AS snapshot_object_key, s.document_count AS snapshot_document_count, s.created_at AS snapshot_created_at
    FROM releases r LEFT JOIN submitted_snapshots s ON s.changeset_id = r.changeset_id WHERE r.id = ?`).bind(releaseId).first();
  if (!release) throw new ApiError(404, 'NOT_FOUND', 'Release was not found');
  const [authorities, approvals, pointer, deploymentReceipts, pointerHistory, deploymentTransactions] = await Promise.all([
    env.CONTENT_DB.prepare(`SELECT document_id, authority, source_path, source_revision, normalized_snapshot_hash
      FROM release_authority_entries WHERE release_id = ? ORDER BY document_id`).bind(releaseId).all(),
    release.snapshot_hash ? env.CONTENT_DB.prepare(`SELECT id, decision_kind, decision, decided_by, comment, created_at
      FROM approvals WHERE changeset_id = ? AND submitted_snapshot_hash = ? AND submitted_snapshot_revision = ? ORDER BY created_at, id`).bind(release.changeset_id, release.snapshot_hash, release.snapshot_revision).all() : Promise.resolve({ results: [] }),
    env.CONTENT_DB.prepare("SELECT release_id, updated_by, updated_at FROM release_pointers WHERE name = 'active'").first(),
    env.CONTENT_DB.prepare(`SELECT id, transaction_id, action, previous_active_release_id, candidate_id,
      candidate_manifest_hash, build_attestation_hash, snapshot_hash, snapshot_revision,
      cloudflare_deployment_id, cloudflare_version_id, verification_hash, receipt_hash,
      recorded_by, recorded_client_id, recorded_run_id, created_at
      FROM deployment_receipts WHERE release_id = ? ORDER BY created_at, id`).bind(releaseId).all(),
    env.CONTENT_DB.prepare(`SELECT sequence, pointer_name, previous_release_id, release_id, transaction_id,
      receipt_id, expected_active_release_id, changed_by, changed_client_id, changed_run_id, changed_at
      FROM release_pointer_history WHERE release_id = ? OR previous_release_id = ? ORDER BY sequence`).bind(releaseId, releaseId).all(),
    env.CONTENT_DB.prepare(`SELECT id, action, state, expected_active_release_id, previous_release_id,
      candidate_id, candidate_manifest_hash, build_attestation_hash, snapshot_hash, snapshot_revision,
      cloudflare_version_id, requested_by, requested_client_id, requested_run_id,
      created_at, expires_at, completed_at
      FROM release_deployment_transactions WHERE release_id = ? ORDER BY created_at, id`).bind(releaseId).all()
  ]);
  const snapshot = release.snapshot_id ? {
    id: release.snapshot_id, hash: release.snapshot_hash, revision: release.snapshot_revision,
    objectKey: release.snapshot_object_key, documentCount: release.snapshot_document_count,
    createdAt: release.snapshot_created_at, downloadPath: `/v1/release-snapshots/${release.snapshot_hash}`
  } : null;
  const publicRelease = { ...release };
  for (const key of ['snapshot_id', 'snapshot_hash', 'snapshot_revision', 'snapshot_object_key', 'snapshot_document_count', 'snapshot_created_at']) delete publicRelease[key];
  return json({
    ...publicRelease,
    snapshot,
    authority: authorities.results || [],
    approvals: approvals.results || [],
    active: pointer?.release_id === releaseId,
    activePointer: pointer || null,
    deploymentReceipts: deploymentReceipts.results || [],
    pointerHistory: pointerHistory.results || [],
    deploymentTransactions: deploymentTransactions.results || []
  });
}

const mediaObjectMime = (filename) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.txt')) return 'text/plain';
  throw new ApiError(422, 'DERIVATIVE_MIME_UNSUPPORTED', 'Processor derivative has an unsupported release MIME type');
};

async function inspectImmutableMediaObject(env, objectKey, role, filename) {
  const object = await env.CONTENT_MEDIA.get(objectKey);
  if (!object) throw new ApiError(503, 'DERIVATIVE_UNAVAILABLE', `Immutable ${role} object is unavailable`);
  if (Number.isFinite(object.size) && (object.size < 1 || object.size > 100 * 1024 * 1024)) throw new ApiError(422, 'DERIVATIVE_SIZE_INVALID', `Immutable ${role} object exceeds the release safety bound`);
  const bytes = await object.arrayBuffer();
  if (bytes.byteLength < 1 || bytes.byteLength > 100 * 1024 * 1024) throw new ApiError(422, 'DERIVATIVE_SIZE_INVALID', `Immutable ${role} object exceeds the release safety bound`);
  return { role, objectKey, sha256: await sha256Bytes(bytes), bytes: bytes.byteLength, mimeType: mediaObjectMime(filename) };
}

async function processorCallback(request, env) {
  requireMediaBindings(env, ['CONTENT_DB', 'CONTENT_MEDIA']);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 131072) throw new ApiError(413, 'BODY_TOO_LARGE', 'Processor callback exceeds 131072 bytes');
  if (!await verifyHmacSignature(env.MEDIA_CALLBACK_SECRET, raw, request.headers.get('x-media-signature'))) throw new ApiError(401, 'CALLBACK_SIGNATURE_INVALID', 'Processor callback signature is invalid');
  let body; try { body = JSON.parse(raw); } catch { throw new ApiError(400, 'INVALID_JSON', 'Callback body must be valid JSON'); }
  const allowed = ['schemaVersion', 'jobId', 'idempotencyKey', 'quarantineObjectKey', 'outputPrefix', 'immutableAddress', 'manifestKey', 'reviews', 'publication'];
  if (!body || typeof body !== 'object' || Object.keys(body).some((key) => !allowed.includes(key))) throw new ApiError(400, 'UNKNOWN_FIELD', 'Processor callback contains unsupported fields');
  if (body.schemaVersion !== 1 || typeof body.idempotencyKey !== 'string' || request.headers.get('idempotency-key') !== body.idempotencyKey) throw new ApiError(400, 'CALLBACK_INVALID', 'Callback schema or idempotency key is invalid');
  const requestHash = await sha256(body);
  const existing = await env.CONTENT_DB.prepare('SELECT request_hash, response_status, response_json FROM media_processor_callbacks WHERE idempotency_key = ?').bind(body.idempotencyKey).first();
  if (existing) {
    if (existing.request_hash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Callback idempotency key was reused with different content');
    return new Response(existing.response_json, { status: existing.response_status, headers: { ...JSON_HEADERS, 'idempotent-replay': 'true' } });
  }
  const job = await env.CONTENT_DB.prepare(`SELECT j.*, t.filename, t.content_type, t.content_hash, t.uploaded_bytes, t.storage_reservation_bytes, t.request_json, t.review_package_id
    FROM media_jobs j JOIN upload_tickets t ON t.id = j.upload_ticket_id WHERE j.id = ?`).bind(body.jobId).first();
  if (!job) throw new ApiError(404, 'NOT_FOUND', 'Media job was not found');
  if (job.state !== 'queued' && job.state !== 'processing') throw new ApiError(409, 'MEDIA_JOB_STATE_INVALID', 'Media job cannot accept a completion callback');
  if (body.quarantineObjectKey !== (await env.CONTENT_DB.prepare('SELECT object_key FROM upload_tickets WHERE id = ?').bind(job.upload_ticket_id).first()).object_key || body.outputPrefix !== `media/${job.id}` || !body.manifestKey?.startsWith(`${body.outputPrefix}/sha256/`)) throw new ApiError(409, 'CALLBACK_JOB_MISMATCH', 'Callback does not match the immutable job envelope');
  const storedManifest = await env.CONTENT_MEDIA.get(body.manifestKey);
  if (!storedManifest) throw new ApiError(503, 'MEDIA_MANIFEST_UNAVAILABLE', 'Processor manifest is unavailable');
  const manifestText = await storedManifest.text();
  let manifest; try { manifest = JSON.parse(manifestText); } catch { throw new ApiError(500, 'MEDIA_MANIFEST_INVALID', 'Processor manifest is invalid JSON'); }
  if (manifest.source?.sha256 !== job.content_hash || manifest.source?.bytes !== job.uploaded_bytes || manifest.source?.detectedMime !== job.content_type || manifest.immutableAddress !== body.immutableAddress || manifest.malwareScan?.state !== 'cleared' || manifest.publication?.state !== 'quarantined' || !manifest.technical) throw new ApiError(422, 'PROCESSOR_RESULT_REJECTED', 'Processor output failed hash, MIME, malware, quarantine, or derivative checks');
  const derivativeName = manifest.technical.derivative || manifest.technical.output;
  if (!derivativeName || /[/\\]|\.\./.test(derivativeName)) throw new ApiError(422, 'DERIVATIVE_REQUIRED', 'A clean immutable derivative is required');
  const derivativeKey = `${body.outputPrefix}/sha256/${job.content_hash}/${derivativeName}`;
  const posterCandidate = typeof manifest.technical.poster === 'string' ? manifest.technical.poster : manifest.technical.poster?.file;
  const posterName = typeof posterCandidate === 'string' && /\.(?:webp|png|jpe?g)$/i.test(posterCandidate) ? posterCandidate : null;
  if (posterName && (/[/\\]|\.\./.test(posterName))) throw new ApiError(422, 'DERIVATIVE_REQUIRED', 'Poster filename is invalid');
  const original = validatePrivateOriginal(manifest.technical.original, { sourceSha256: job.content_hash, sourceBytes: job.uploaded_bytes });
  if (mediaObjectMime(original.file) !== job.content_type) throw new ApiError(422, 'ORIGINAL_OBJECT_INVALID', 'Private original filename does not match the uploaded MIME');
  const originalObject = await inspectImmutableMediaObject(env, `${body.outputPrefix}/sha256/${job.content_hash}/${original.file}`, 'original', original.file);
  if (originalObject.sha256 !== job.content_hash || originalObject.bytes !== job.uploaded_bytes || originalObject.mimeType !== job.content_type) throw new ApiError(422, 'ORIGINAL_OBJECT_MISMATCH', 'Private original bytes do not match the reviewed upload');
  const inspectedObjects = [await inspectImmutableMediaObject(env, derivativeKey, 'derivative', derivativeName)];
  if (posterName && posterName !== derivativeName) inspectedObjects.push(await inspectImmutableMediaObject(env, `${body.outputPrefix}/sha256/${job.content_hash}/${posterName}`, 'poster', posterName));
  const responsiveCandidates = Array.isArray(manifest.technical.responsive) ? manifest.technical.responsive : [];
  for (const candidate of responsiveCandidates) {
    if (!candidate || ![640, 1280, 1920].includes(candidate.width) || typeof candidate.file !== 'string' || candidate.file !== `display-${candidate.width}.webp`) throw new ApiError(422, 'RESPONSIVE_DERIVATIVE_INVALID', 'Responsive image derivative metadata is invalid');
    inspectedObjects.push(await inspectImmutableMediaObject(env, `${body.outputPrefix}/sha256/${job.content_hash}/${candidate.file}`, `responsive-${candidate.width}`, candidate.file));
  }
  const completedAt = now();
  const mediaId = await deterministicId('media', { sourceSha256: job.content_hash });
  const mediaVersionId = await deterministicId('mediaversion', { mediaId, sourceSha256: job.content_hash, manifestKey: body.manifestKey });
  const uploadRequest = parseStoredJson(job.request_json, 'Upload request metadata');
  const reviewPackage = await env.CONTENT_DB.prepare('SELECT * FROM media_review_packages WHERE id = ?').bind(job.review_package_id).first();
  if (!reviewPackage || reviewPackage.id !== uploadRequest.reviews?.reviewPackageId) throw new ApiError(422, 'REVIEW_PACKAGE_NOT_FOUND', 'Processor job lost its persisted review package');
  const rightsReviewId = reviewPackage.rights_review_id;
  if (body.reviews?.rights?.reviewId !== rightsReviewId || body.reviews?.editorial?.reviewId !== reviewPackage.editorial_review_id || body.reviews?.accessibility?.reviewId !== reviewPackage.accessibility_review_id) throw new ApiError(409, 'CALLBACK_REVIEW_MISMATCH', 'Processor callback review IDs do not match the persisted package');
  const rightsCaseId = await deterministicId('rightscase', { mediaVersionId, rightsReviewId });
  const rightsStatus = reviewPackage.state === 'cleared' ? 'cleared' : reviewPackage.state === 'rejected' ? 'blocked' : 'reviewRequired';
  const technical = { ...manifest.technical, ...(uploadRequest.transcriptEquivalent ? { transcriptEquivalent: { language: uploadRequest.transcriptEquivalent.language, text: uploadRequest.transcriptEquivalent.text, kind: 'transcript-equivalent-not-timed-captions' } } : {}) };
  const reviewedManifest = { ...manifest, sourceProcessorManifestKey: body.manifestKey, technical, reviewPackage: { id: reviewPackage.id, declarationHash: reviewPackage.declaration_hash, state: reviewPackage.state }, accessibility: { transcriptEquivalent: technical.transcriptEquivalent || null, timedCaptionTrack: false } };
  const reviewedManifestJson = stableStringify(reviewedManifest);
  const reviewedManifestHash = await sha256(reviewedManifestJson);
  const reviewedManifestKey = `${body.outputPrefix}/sha256/${job.content_hash}/reviewed-manifest-${reviewedManifestHash}.json`;
  const existingReviewedManifest = await env.CONTENT_MEDIA.get(reviewedManifestKey);
  if (existingReviewedManifest) {
    if (await sha256(await existingReviewedManifest.text()) !== reviewedManifestHash) throw new ApiError(500, 'MEDIA_MANIFEST_HASH_MISMATCH', 'Existing reviewed manifest failed immutable hash verification');
  } else await env.CONTENT_MEDIA.put(reviewedManifestKey, reviewedManifestJson, { httpMetadata: { contentType: 'application/json' }, customMetadata: { sha256: reviewedManifestHash, mediaVersionId, reviewPackageId: reviewPackage.id } });
  const response = { jobId: job.id, state: 'ready', mediaId, mediaVersionId, rightsCaseId, rightsStatus, derivativeKey, placementReady: rightsStatus === 'cleared' };
  const processorIdentity = { actorId: 'actor_media_processor', actorType: 'service', clientId: 'github-media-workflow', runId: job.id, scopes: new Set() };
  const statements = [
    env.CONTENT_DB.prepare("INSERT INTO media_assets (id, title, state, created_by, created_at, updated_at) VALUES (?, ?, 'ready', ?, ?, ?)").bind(mediaId, job.filename, processorIdentity.actorId, completedAt, completedAt),
    env.CONTENT_DB.prepare(`INSERT INTO media_asset_versions (id, media_id, source_sha256, source_bytes, detected_mime, immutable_address, manifest_object_key, technical_json, derivatives_json, processor_version, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(mediaVersionId, mediaId, job.content_hash, job.uploaded_bytes, job.content_type, manifest.immutableAddress, reviewedManifestKey, JSON.stringify(technical), JSON.stringify({ outputPrefix: body.outputPrefix, objects: inspectedObjects, reviewedManifest: { objectKey: reviewedManifestKey, sha256: reviewedManifestHash } }), 'media-workflow-v1', processorIdentity.actorId, completedAt),
    env.CONTENT_DB.prepare(`INSERT INTO media_rights_cases (id, media_version_id, review_id, status, evidence_json, created_at, review_package_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(rightsCaseId, mediaVersionId, rightsReviewId, rightsStatus, JSON.stringify(body.reviews.rights), completedAt, reviewPackage.id),
    env.CONTENT_DB.prepare(`INSERT INTO media_original_objects
      (id, media_version_id, object_key, object_sha256, object_bytes, content_type, private, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
      .bind(await deterministicId('mediaoriginal', { mediaVersionId, sha256: originalObject.sha256 }), mediaVersionId, originalObject.objectKey, originalObject.sha256, originalObject.bytes, originalObject.mimeType, completedAt),
    env.CONTENT_DB.prepare("UPDATE media_jobs SET state = 'ready', manifest_object_key = ?, updated_at = ?, completed_at = ? WHERE id = ? AND state IN ('queued', 'processing')").bind(reviewedManifestKey, completedAt, completedAt, job.id),
    env.CONTENT_DB.prepare("UPDATE upload_tickets SET state = 'consumed', consumed_at = ? WHERE id = ? AND state = 'uploaded'").bind(completedAt, job.upload_ticket_id),
    env.CONTENT_DB.prepare("UPDATE media_budget_global SET reserved_bytes = reserved_bytes - ?, stored_bytes = stored_bytes + ?, updated_at = ? WHERE id = 'global'").bind(job.storage_reservation_bytes, job.storage_reservation_bytes, completedAt),
    env.CONTENT_DB.prepare('INSERT INTO media_processor_callbacks (idempotency_key, job_id, request_hash, response_status, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(body.idempotencyKey, job.id, requestHash, 201, JSON.stringify(response), completedAt),
    await audit(env, processorIdentity, 'media.processor.completed', 'media_job', job.id, { mediaId, mediaVersionId, rightsCaseId, reviewPackageId: reviewPackage.id, rightsStatus, sourceManifestKey: body.manifestKey, reviewedManifestKey, reviewedManifestHash, objects: inspectedObjects.map(({ role, sha256, bytes, mimeType }) => ({ role, sha256, bytes, mimeType })) })
  ];
  for (const object of inspectedObjects) statements.splice(3, 0, env.CONTENT_DB.prepare(`INSERT INTO media_version_objects
    (id, media_version_id, role, object_key, object_sha256, object_bytes, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(await deterministicId('mediaobject', { mediaVersionId, role: object.role, sha256: object.sha256 }), mediaVersionId, object.role, object.objectKey, object.sha256, object.bytes, object.mimeType, completedAt));
  await env.CONTENT_DB.batch(statements);
  // The exact original now exists in the immutable private media prefix. The
  // temporary upload is redundant; lifecycle remains a fail-safe if deletion
  // is transiently unavailable.
  try { await env.UPLOAD_QUARANTINE?.delete(body.quarantineObjectKey); } catch {}
  return json(response, 201);
}

async function activateD1Authorities(request, env, identity, fixedDocumentId = null) {
  requireAuthorityWorkflowIdentity(identity);
  if (!env.CONTENT_SNAPSHOTS) throw new ApiError(503, 'SNAPSHOT_STORE_UNAVAILABLE', 'Snapshot storage is unavailable');
  const body = await readJsonBody(request, { allowedFields: fixedDocumentId ? ['releaseId', 'normalizedSnapshotHash', 'sourceRevision', 'idempotencyKey'] : ['releaseId', 'documents', 'idempotencyKey'] });
  validId(body.releaseId, 'releaseId');
  let documents = fixedDocumentId ? [{ documentId: fixedDocumentId, normalizedSnapshotHash: body.normalizedSnapshotHash, sourceRevision: body.sourceRevision }] : body.documents;
  if (!Array.isArray(documents) || documents.length < 1 || documents.length > 18) throw new ApiError(422, 'AUTHORITY_DOCUMENTS_INVALID', 'documents must contain 1 to 18 exact authority entries');
  const seen = new Set();
  documents = documents.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some((key) => !['documentId', 'normalizedSnapshotHash', 'sourceRevision'].includes(key))) throw new ApiError(422, 'AUTHORITY_DOCUMENTS_INVALID', 'Each authority entry must contain only documentId, normalizedSnapshotHash, and sourceRevision');
    const documentId = validId(item.documentId, 'documentId'); const sourceRevision = validId(item.sourceRevision, 'sourceRevision');
    if (!/^[a-f0-9]{64}$/.test(item.normalizedSnapshotHash || '')) throw new ApiError(422, 'HASH_INVALID', 'normalizedSnapshotHash must be exact lowercase SHA-256');
    if (seen.has(documentId)) throw new ApiError(422, 'AUTHORITY_DOCUMENTS_INVALID', 'Authority document IDs must be unique');
    seen.add(documentId); return { documentId, sourceRevision, normalizedSnapshotHash: item.normalizedSnapshotHash };
  }).sort((a, b) => a.documentId.localeCompare(b.documentId));
  await enforceRateLimit(env, identity, 'mutation');
  const idem = await beginIdempotency(env, identity, fixedDocumentId ? `authority:${fixedDocumentId}:d1` : 'authority:d1:batch', body.idempotencyKey, { releaseId: body.releaseId, documents });
  if (idem.replay) return idem.replay;
  const active = await env.CONTENT_DB.prepare("SELECT release_id FROM release_pointers WHERE name = 'active'").first();
  if (active?.release_id !== body.releaseId) throw new ApiError(409, 'ACTIVE_RELEASE_CONFLICT', 'Authority cutover must bind the exact active release', { activeReleaseId: active?.release_id || null });
  const snapshotRow = await env.CONTENT_DB.prepare(`SELECT s.snapshot_hash, s.r2_object_key, s.changeset_id
    FROM releases r JOIN submitted_snapshots s ON s.changeset_id = r.changeset_id
    WHERE r.id = ? AND r.state = 'published'`).bind(body.releaseId).first();
  if (!snapshotRow) throw new ApiError(409, 'ACTIVE_RELEASE_CONFLICT', 'Active release lacks its persisted submitted snapshot');
  const storedSnapshot = await env.CONTENT_SNAPSHOTS.get(snapshotRow.r2_object_key);
  if (!storedSnapshot) throw new ApiError(503, 'SNAPSHOT_STORE_UNAVAILABLE', 'Active release snapshot bytes are unavailable');
  const snapshotText = await storedSnapshot.text();
  if (await sha256(snapshotText) !== snapshotRow.snapshot_hash) throw new ApiError(500, 'SNAPSHOT_HASH_MISMATCH', 'Active release snapshot bytes failed integrity verification');
  const submittedSnapshot = parseStoredJson(snapshotText, 'Active release snapshot');
  const snapshotDocuments = new Map((submittedSnapshot.documents || []).map((item) => [item.documentId, item]));
  const prepared = [];
  for (const item of documents) {
    const chapter = await env.CONTENT_DB.prepare('SELECT id, current_revision_id, current_content_hash FROM documents WHERE id = ?').bind(item.documentId).first();
    if (!chapter) throw new ApiError(404, 'NOT_FOUND', `${item.documentId} was not found`);
    const submitted = snapshotDocuments.get(item.documentId);
    if (!submitted?.content || submitted.revisionId !== item.sourceRevision || submitted.submittedContentHash !== item.normalizedSnapshotHash || await sha256(submitted.content) !== item.normalizedSnapshotHash || submitted.content.revisionId !== item.sourceRevision || submitted.content.chapterVersion !== item.sourceRevision) throw new ApiError(409, 'AUTHORITY_HASH_MISMATCH', 'Authority cutover must bind the exact finalized document in the active release snapshot', { documentId: item.documentId });
    let liveAdvance = null;
    if (chapter.current_revision_id !== item.sourceRevision && chapter.current_revision_id !== submitted.baseRevisionId) {
      liveAdvance = await verifiedLiveSaveLineage(env, item.documentId, item.sourceRevision, chapter.current_revision_id);
      if (!liveAdvance || liveAdvance.currentContentHash !== chapter.current_content_hash) throw new ApiError(409, 'REVISION_CONFLICT', 'Canonical document head changed after the submitted snapshot was created', { documentId: item.documentId, baseRevisionId: submitted.baseRevisionId, currentRevisionId: chapter.current_revision_id });
    }
    const releaseEntry = await env.CONTENT_DB.prepare(`SELECT authority, source_revision, normalized_snapshot_hash FROM release_authority_entries
      WHERE release_id = ? AND document_id = ?`).bind(body.releaseId, item.documentId).first();
    if (releaseEntry?.authority !== 'd1' || releaseEntry.source_revision !== item.sourceRevision || releaseEntry.normalized_snapshot_hash !== item.normalizedSnapshotHash) throw new ApiError(409, 'RELEASE_AUTHORITY_MISMATCH', 'The active release does not contain the exact requested D1 authority entry', { documentId: item.documentId });
    const current = await env.CONTENT_DB.prepare('SELECT authority, source_revision, normalized_snapshot_hash FROM authority_registry WHERE document_id = ? AND active = 1').bind(item.documentId).first();
    if (liveAdvance && (current?.authority !== 'd1' || current.source_revision !== item.sourceRevision || current.normalized_snapshot_hash !== item.normalizedSnapshotHash)) throw new ApiError(409, 'RELEASE_AUTHORITY_MISMATCH', 'A code-only release may preserve a live-saved canonical head only when the existing D1 authority already matches the exact release snapshot', { documentId: item.documentId });
    const revision = await env.CONTENT_DB.prepare('SELECT document_id, content_hash FROM document_revisions WHERE id = ?').bind(item.sourceRevision).first();
    if (revision && (revision.document_id !== item.documentId || revision.content_hash !== item.normalizedSnapshotHash)) throw new ApiError(409, 'REVISION_CONFLICT', 'Finalized revision ID already exists with conflicting content', { documentId: item.documentId });
    prepared.push({ ...item, submitted, chapter, current, revisionExists: Boolean(revision), liveAdvance });
  }
  const changedAt = now();
  const activated = []; const statements = [];
  for (const item of prepared) {
    const authorityId = await deterministicId('authority', item);
    activated.push({ documentId: item.documentId, sourceRevision: item.sourceRevision, normalizedSnapshotHash: item.normalizedSnapshotHash, authority: 'd1', headPromoted: !item.liveAdvance && item.chapter.current_revision_id !== item.sourceRevision, liveAdvance: Boolean(item.liveAdvance), liveRevisionCount: item.liveAdvance?.revisionCount || 0 });
    if (!item.revisionExists) statements.push(env.CONTENT_DB.prepare(`INSERT INTO document_revisions
      (id, document_id, parent_revision_id, content_hash, content_text, r2_object_key, metadata_json, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`).bind(item.sourceRevision, item.documentId, item.submitted.baseRevisionId, item.normalizedSnapshotHash, stableStringify(item.submitted.content), stableStringify({ status: 'published', releaseId: body.releaseId, snapshotHash: snapshotRow.snapshot_hash }), identity.actorId, changedAt));
    if (!item.liveAdvance && item.chapter.current_revision_id !== item.sourceRevision) statements.push(env.CONTENT_DB.prepare(`UPDATE documents SET current_revision_id = ?, current_content_hash = ?, updated_at = ?
      WHERE id = ? AND current_revision_id = ?`).bind(item.sourceRevision, item.normalizedSnapshotHash, changedAt, item.documentId, item.submitted.baseRevisionId));
    if (item.current?.authority !== 'd1' || item.current.source_revision !== item.sourceRevision || item.current.normalized_snapshot_hash !== item.normalizedSnapshotHash) {
      statements.push(env.CONTENT_DB.prepare('UPDATE authority_registry SET active = 0, valid_until = ? WHERE document_id = ? AND active = 1').bind(changedAt, item.documentId));
      statements.push(env.CONTENT_DB.prepare(`INSERT INTO authority_registry
      (id, document_id, authority, source_path, source_revision, normalized_snapshot_hash, active, valid_from, created_at)
      VALUES (?, ?, 'd1', NULL, ?, ?, 1, ?, ?)
      ON CONFLICT(document_id, source_revision) DO UPDATE SET authority = 'd1', source_path = NULL,
        normalized_snapshot_hash = excluded.normalized_snapshot_hash, active = 1, valid_from = excluded.valid_from,
        valid_until = NULL`).bind(authorityId, item.documentId, item.sourceRevision, item.normalizedSnapshotHash, changedAt, changedAt));
    }
  }
  statements.push(env.CONTENT_DB.prepare("UPDATE changesets SET state = 'applied', applied_at = ?, updated_at = ? WHERE id = ? AND state = 'approved'").bind(changedAt, changedAt, snapshotRow.changeset_id));
  const response = { releaseId: body.releaseId, authority: 'd1', activated, activatedAt: changedAt };
  statements.push(idempotencyStatement(env, idem, body.idempotencyKey, 201, response, changedAt));
  statements.push(await audit(env, identity, fixedDocumentId ? 'authority.canary.activated' : 'authority.batch.activated', 'release', body.releaseId, { documentIds: activated.map((item) => item.documentId), documentCount: activated.length, liveAdvances: activated.filter((item) => item.liveAdvance).map((item) => ({ documentId: item.documentId, revisionCount: item.liveRevisionCount })) }, { idempotencyHash: idem.requestHash }));
  await env.CONTENT_DB.batch(statements);
  return json(response, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'content-api', db_configured: Boolean(env.CONTENT_DB), media_configured: Boolean(env.CONTENT_MEDIA) });
      if (!url.pathname.startsWith('/v1/')) throw new ApiError(404, 'NOT_FOUND', 'Route was not found');
      if (request.method === 'POST' && url.pathname === '/v1/media:processorCallback') return await processorCallback(request, env);
      const identity = trustedIdentity(request);
      if (request.method === 'GET' && (url.pathname === '/v1/media' || url.pathname.startsWith('/v1/media/'))) {
        if (!identity.scopes.has('media:read') && !identity.scopes.has('content:read')) throw new ApiError(403, 'FORBIDDEN', 'Scope media:read or content:read is required');
      } else if (request.method === 'GET' && !url.pathname.startsWith('/v1/release-snapshots/') && !url.pathname.startsWith('/v1/release-assets/')) requireScope(identity, 'content:read');
      if (request.method === 'GET' && url.pathname === '/v1/schema') return json({
        schemaVersion: 1,
        mutationEnvelope: { required: ['baseRevisionId', 'expectedVersion', 'idempotencyKey', 'operation'], optional: ['documentId', 'dryRun'], multiDocumentRule: 'documentId is required when a changeset targets more than one document' },
        changesets: { create: { route: 'POST /v1/changesets', required: ['title', 'targets', 'idempotencyKey'], optional: ['description'], targets: '1-18 unique document IDs with active D1 authoring authority' }, saveLive: { route: 'POST /v1/changesets/{changesetId}:saveLive', required: ['baseRevisionId', 'expectedVersion', 'idempotencyKey'], requiredScopes: ['content:write'], agentAdditionalScope: 'content:live-save', humanActorAllowed: true, result: 'new immutable canonical revision visible on the public reader' }, submit: { route: 'POST /v1/changesets/{changesetId}:submitReview', singleDocumentPreconditions: ['baseRevisionId', 'expectedVersion'], multiDocumentPreconditions: 'documents[] must bind documentId, baseRevisionId, and expectedVersion for every target' } },
        operations: OPERATION_PAYLOAD_SCHEMAS,
        reads: {
          passages: { route: 'GET /v1/chapters/{chapterId}/passages', query: { limit: '1-100', cursor: '0-10000' } },
          passage: { route: 'GET /v1/chapters/{chapterId}/passages/{passageId}' },
          dependencies: { route: 'GET /v1/chapters/{chapterId}/dependencies', query: { passageId: 'optional stable passage ID', limit: '1-100', cursor: '0-10000' } }
        },
        review: {
          diff: { route: 'POST /v1/changesets/{changesetId}:diff', required: [], optional: ['documentId'], scope: 'content:read' },
          approve: { route: 'POST /v1/changesets/{changesetId}:approve', scope: 'content:approve', humanActorRequired: true },
          reject: { route: 'POST /v1/changesets/{changesetId}:reject', required: ['snapshotHash', 'snapshotRevision', 'decisionKind', 'comment', 'idempotencyKey'], scope: 'content:approve', humanActorRequired: true },
          restoreAsDraft: { route: 'POST /v1/chapters/{chapterId}/revisions/{revisionId}:restoreAsDraft', required: ['title', 'idempotencyKey'], optional: ['description'], scope: 'content:write' }
        },
        preview: { route: 'POST /v1/changesets/{changesetId}:renderPreview', required: ['baseRevisionId', 'expectedVersion', 'idempotencyKey'], optional: ['documentId', 'surface'], surfaces: ['web', 'mobile', 'print', 'offline'], ttlSeconds: 300, oneTime: true, immutableSnapshot: true, scope: 'content:write' },
        release: {
          metadata: { route: 'GET /v1/releases/{releaseId}', scope: 'content:read', includes: ['snapshot', 'authority', 'approvals', 'activePointer', 'deploymentReceipts', 'pointerHistory', 'deploymentTransactions'] },
          publish: { route: 'POST /v1/changesets/{changesetId}:publish', scope: 'content:publish', humanActorRequired: true, enabled: false, requires: 'deployment attestation + receipt + expected-active CAS' },
          stageDeployment: { route: 'POST /v1/release-deployments:stage', scope: 'content:deployReceipt', serviceOnly: true, clientId: 'github-content-release' },
          pendingDeployment: { route: 'POST /v1/release-deployments:pending', scope: 'content:deployReceipt', serviceOnly: true, contentFree: true },
          recordReceipt: { route: 'POST /v1/release-deployments/{transactionId}:recordReceipt', scope: 'content:deployReceipt', serviceOnly: true, exactHashBinding: true, expectedActiveCas: true },
          reconcileReceipt: { route: 'POST /v1/release-deployments/{transactionId}:reconcileReceipt', scope: 'content:deployReceipt', serviceOnly: true, allowsExpiredStagedTransaction: true, exactHashBinding: true, expectedActiveCas: true },
          abandonDeployment: { route: 'POST /v1/release-deployments/{transactionId}:abandon', scope: 'content:deployReceipt', serviceOnly: true, requiresExactRecoveryVersion: true },
          stageRollback: { route: 'POST /v1/releases/{releaseId}:stageRollback', scope: 'content:deployReceipt', serviceOnly: true, selectsPreviouslyPromotedVersion: true },
          auditState: { route: 'POST /v1/releases/{releaseId}:auditState', scope: 'content:authority', serviceOnly: true, completeAuthorityMap: true, canonicalHeadBinding: true },
          snapshot: { route: 'GET /v1/release-snapshots/{snapshotHash}', scope: 'content:releaseSnapshot', integrity: 'exact SHA-256 bytes', requiresExactReleaseApproval: true },
          asset: { route: 'GET /v1/release-assets/{sha256}', scope: 'content:releaseSnapshot', integrity: 'DB-referenced exact SHA-256 bytes', requiresExactReleaseApproval: true }
        },
        media: { search: { route: 'GET /v1/media', query: { q: 'max 100 characters', kind: ['image', 'audio', 'video', 'document'], rightsStatus: ['reviewRequired', 'cleared', 'blocked'], sha256: 'exact lowercase SHA-256', limit: '1-50', cursor: '0-10000' } }, reviewPackage: { create: { route: 'POST /v1/media-review-packages', required: ['rights', 'editorial', 'accessibility', 'idempotencyKey'], resultState: 'pending' }, decide: { route: 'POST /v1/media-review-packages/{reviewPackageId}:decide', required: ['declarationHash', 'decision', 'comment', 'idempotencyKey'], decisions: ['cleared', 'blocked'], scope: 'content:approve', humanActorRequired: true } }, requestUpload: { route: 'POST /v1/media:requestUpload', required: ['filename', 'mimeType', 'bytes', 'sha256', 'idempotencyKey', 'reviewPackageId'], optional: ['transcriptEquivalent', 'poster'], transcriptEquivalent: { requiredFor: ['audio/*', 'video/*'], required: ['provided', 'language', 'text'], maxTextCharacters: 50000, timedCaptionTrackClaimed: false }, policy: MEDIA_UPLOAD_POLICY }, upload: { route: 'PUT /v1/media/uploads/{ticketId}', body: 'raw bytes', requiredHeaders: ['content-type', 'content-length', 'x-content-sha256', 'x-upload-token'] }, jobStatus: { route: 'GET /v1/media/jobs/{jobId}' }, mediaStatus: { route: 'GET /v1/media/{mediaId}' }, processorCallback: { route: 'POST /v1/media:processorCallback', auth: 'HMAC-SHA-256 raw body', required: ['schemaVersion', 'jobId', 'idempotencyKey', 'quarantineObjectKey', 'outputPrefix', 'immutableAddress', 'manifestKey', 'reviews', 'publication'], requiredHeaders: ['idempotency-key', 'x-media-signature'] } },
        providers: { registry: PROVIDER_REGISTRY, resolve: { route: 'POST /v1/embeds:resolve', required: ['url'], optional: ['expectedProvider'], scope: 'content:write', networkAccess: false } },
        rateLimits: { windowSeconds: RATE_WINDOW_SECONDS, mutation: RATE_LIMITS.mutation, upload: RATE_LIMITS.upload, key: 'trusted actor + client', persistence: 'D1 fail-closed' },
        authority: { prepareCutover: { route: 'POST /v1/authority:prepareCutover', required: ['title', 'targets', 'idempotencyKey'], serviceOnly: true, readOnlyProposal: true, currentAuthority: 'git' }, activateBatch: { route: 'POST /v1/authority:activateD1', required: ['releaseId', 'documents', 'idempotencyKey'], serviceOnly: true, exactActiveReleaseBinding: true, databaseGuarded: true }, canaryCompatibility: { route: 'POST /v1/authority/chapter_ch07:activateD1', required: ['releaseId', 'normalizedSnapshotHash', 'sourceRevision', 'idempotencyKey'], fixedDocumentId: 'chapter_ch07' } }
      });
      if (request.method === 'GET' && url.pathname === '/v1/chapters') return await listChapters(env);
      if (request.method === 'GET' && url.pathname === '/v1/media') return await searchMedia(env, url);
      let snapshotMatch = url.pathname.match(/^\/v1\/release-snapshots\/([a-f0-9]{64})$/);
      if (request.method === 'GET' && snapshotMatch) return await getReleaseSnapshot(env, identity, snapshotMatch[1]);
      let releaseAssetMatch = url.pathname.match(/^\/v1\/release-assets\/([a-f0-9]{64})$/);
      if (request.method === 'GET' && releaseAssetMatch) return await getReleaseAsset(env, identity, releaseAssetMatch[1]);
      let releaseMatch = url.pathname.match(/^\/v1\/releases\/([^/:]+)$/);
      if (request.method === 'GET' && releaseMatch) return await getRelease(env, validId(decodeURIComponent(releaseMatch[1]), 'releaseId'));
      if (request.method === 'POST' && url.pathname === '/v1/release-deployments:stage') return await stageReleaseDeployment(request, env, identity);
      if (request.method === 'POST' && url.pathname === '/v1/release-deployments:pending') return await pendingDeploymentState(request, env, identity);
      let deploymentReceiptMatch = url.pathname.match(/^\/v1\/release-deployments\/([^/:]+):recordReceipt$/);
      if (request.method === 'POST' && deploymentReceiptMatch) return await recordDeploymentReceipt(request, env, identity, validId(decodeURIComponent(deploymentReceiptMatch[1]), 'transactionId'));
      let deploymentReconcileMatch = url.pathname.match(/^\/v1\/release-deployments\/([^/:]+):reconcileReceipt$/);
      if (request.method === 'POST' && deploymentReconcileMatch) return await recordDeploymentReceipt(request, env, identity, validId(decodeURIComponent(deploymentReconcileMatch[1]), 'transactionId'), { allowExpired: true, reconciled: true });
      let deploymentAbandonMatch = url.pathname.match(/^\/v1\/release-deployments\/([^/:]+):abandon$/);
      if (request.method === 'POST' && deploymentAbandonMatch) return await abandonDeployment(request, env, identity, validId(decodeURIComponent(deploymentAbandonMatch[1]), 'transactionId'));
      let rollbackMatch = url.pathname.match(/^\/v1\/releases\/([^/:]+):stageRollback$/);
      if (request.method === 'POST' && rollbackMatch) return await stageReleaseRollback(request, env, identity, validId(decodeURIComponent(rollbackMatch[1]), 'releaseId'));
      let releaseAuditMatch = url.pathname.match(/^\/v1\/releases\/([^/:]+):auditState$/);
      if (request.method === 'POST' && releaseAuditMatch) return await auditReleaseState(request, env, identity, validId(decodeURIComponent(releaseAuditMatch[1]), 'releaseId'));
      if (request.method === 'POST' && url.pathname === '/v1/media:requestUpload') return await requestMediaUpload(request, env, identity);
      if (request.method === 'POST' && url.pathname === '/v1/media-review-packages') return await createMediaReviewPackage(request, env, identity);
      if (request.method === 'POST' && url.pathname === '/v1/authority:prepareCutover') return await createMultiDocumentChangeset(request, env, identity, { authorityCutover: true });
      if (request.method === 'POST' && url.pathname === '/v1/changesets') return await createMultiDocumentChangeset(request, env, identity);
      if (request.method === 'POST' && url.pathname === '/v1/embeds:resolve') return await resolveEmbed(request, identity);
      if (request.method === 'POST' && url.pathname === '/v1/authority:activateD1') return await activateD1Authorities(request, env, identity);
      if (request.method === 'POST' && url.pathname === '/v1/authority/chapter_ch07:activateD1') return await activateD1Authorities(request, env, identity, 'chapter_ch07');
      let reviewPackageMatch = url.pathname.match(/^\/v1\/media-review-packages\/([^/:]+):decide$/);
      if (request.method === 'POST' && reviewPackageMatch) return await decideMediaReviewPackage(request, env, identity, validId(decodeURIComponent(reviewPackageMatch[1]), 'reviewPackageId'));
      let match = url.pathname.match(/^\/v1\/chapters\/([^/:]+)\/passages\/([^/:]+)$/);
      if (request.method === 'GET' && match) return await getChapterPassage(env, validId(decodeURIComponent(match[1]), 'chapterId'), validId(decodeURIComponent(match[2]), 'passageId'));
      match = url.pathname.match(/^\/v1\/chapters\/([^/:]+)\/passages$/);
      if (request.method === 'GET' && match) return await listChapterPassages(env, validId(decodeURIComponent(match[1]), 'chapterId'), url);
      match = url.pathname.match(/^\/v1\/chapters\/([^/:]+)\/dependencies$/);
      if (request.method === 'GET' && match) return await getChapterDependencies(env, validId(decodeURIComponent(match[1]), 'chapterId'), url);
      match = url.pathname.match(/^\/v1\/chapters\/([^/:]+)\/revisions$/);
      if (request.method === 'GET' && match) return await listChapterRevisions(env, validId(decodeURIComponent(match[1]), 'chapterId'), url);
      match = url.pathname.match(/^\/v1\/(?:chapters|documents)\/([^/:]+)$/);
      if (request.method === 'GET' && match) return await getChapter(env, validId(decodeURIComponent(match[1]), 'chapterId'));
      match = url.pathname.match(/^\/v1\/chapters\/([^/:]+)\/changesets$/);
      if (request.method === 'POST' && match) return await createOrResumeChangeset(request, env, identity, validId(decodeURIComponent(match[1]), 'chapterId'));
      match = url.pathname.match(/^\/v1\/chapters\/([^/:]+)\/revisions\/([^/:]+):restoreAsDraft$/);
      if (request.method === 'POST' && match) return await restoreRevisionAsDraft(request, env, identity, validId(decodeURIComponent(match[1]), 'chapterId'), validId(decodeURIComponent(match[2]), 'revisionId'));
      match = url.pathname.match(/^\/v1\/changesets\/([^/:]+)$/);
      if (request.method === 'GET' && match) return await getChangeset(env, validId(decodeURIComponent(match[1]), 'changesetId'));
      match = url.pathname.match(/^\/v1\/media\/uploads\/([^/:]+)$/);
      if (request.method === 'PUT' && match) return await uploadMediaBytes(request, env, identity, validId(decodeURIComponent(match[1]), 'ticketId'));
      match = url.pathname.match(/^\/v1\/media\/jobs\/([^/:]+)$/);
      if (request.method === 'GET' && match) return await getMediaJob(env, validId(decodeURIComponent(match[1]), 'jobId'));
      match = url.pathname.match(/^\/v1\/media\/([^/:]+)$/);
      if (request.method === 'GET' && match) return await getMediaAsset(env, validId(decodeURIComponent(match[1]), 'mediaId'));
      match = url.pathname.match(/^\/v1\/changesets\/([^/:]+):(apply|validate|saveLive|submitReview|approve|reject|diff|renderPreview|publish)$/);
      if (request.method === 'POST' && match) {
        const changesetId = validId(decodeURIComponent(match[1]), 'changesetId');
        if (match[2] === 'diff') { requireScope(identity, 'content:read'); return await diffChangeset(request, env, changesetId); }
        if (match[2] === 'apply') return await applyOperation(request, env, identity, changesetId);
        if (match[2] === 'saveLive') return await saveChangesetLive(request, env, identity, changesetId);
        if (match[2] === 'validate') return await validateChangeset(request, env, identity, changesetId);
        if (match[2] === 'renderPreview') return await renderPreview(request, env, identity, changesetId);
        if (match[2] === 'submitReview') return await submitChangeset(request, env, identity, changesetId);
        if (match[2] === 'approve') return await approveChangeset(request, env, identity, changesetId);
        if (match[2] === 'reject') return await rejectChangeset(request, env, identity, changesetId);
        return await publishChangeset(request, env, identity, changesetId);
      }
      throw new ApiError(404, 'NOT_FOUND', 'Route was not found');
    } catch (error) {
      if (error instanceof ApiError) return errorJson(error.status, error.code, error.message, error.details);
      if (error instanceof ConflictError) return errorJson(409, error.code.toUpperCase(), error.message, error.current);
      if (/RELEASE_POINTER_CAS_MISMATCH/.test(error?.message || '')) return errorJson(409, 'ACTIVE_RELEASE_CONFLICT', 'Active release changed while the deployment receipt was being recorded');
      if (/release_deployment_one_staged_book|release_deployment_transactions\.book_key/.test(error?.message || '')) return errorJson(409, 'RELEASE_BUSY', 'Another protected release or rollback transaction is already staged');
      if (/authority_d1_active_release_required/.test(error?.message || '')) return errorJson(409, 'ACTIVE_RELEASE_CONFLICT', 'D1 authority requires an exact matching active published release');
      if (/constraint failed|UNIQUE constraint/i.test(error?.message || '')) return errorJson(409, 'REVISION_CONFLICT', 'A concurrent or duplicate mutation was rejected');
      return errorJson(500, 'INTERNAL_ERROR', 'Internal server error');
    }
  }
};
