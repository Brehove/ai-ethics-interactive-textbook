/** Small, dependency-free workflow rules shared by the Worker and tests. */

export const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

export const sha256 = async (value) => {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : stableStringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
export const sha256Bytes = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const deterministicId = async (namespace, value) => `${namespace}_${(await sha256(value)).slice(0, 24)}`;

/** Canonical hash-bound receipt written only after the protected workflow changes traffic. */
export const deploymentReceiptPayload = (value) => ({
  schemaVersion: 1,
  transactionId: value.transactionId,
  action: value.action,
  releaseId: value.releaseId,
  previousActiveReleaseId: value.previousActiveReleaseId ?? null,
  candidateId: value.candidateId ?? null,
  snapshotHash: value.snapshotHash ?? null,
  snapshotRevision: value.snapshotRevision ?? null,
  candidateManifestHash: value.candidateManifestHash,
  buildAttestationHash: value.buildAttestationHash,
  cloudflareDeploymentId: value.cloudflareDeploymentId,
  cloudflareVersionId: value.cloudflareVersionId,
  verificationHash: value.verificationHash
});

export const deploymentReceiptHash = async (value) => sha256(deploymentReceiptPayload(value));

export const validatePrivateOriginal = (descriptor, { sourceSha256, sourceBytes }) => {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor) || descriptor.private !== true
    || typeof descriptor.file !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(descriptor.file) || descriptor.file.includes('..')
    || descriptor.sha256 !== sourceSha256 || descriptor.bytes !== sourceBytes) {
    throw new ApiError(422, 'ORIGINAL_OBJECT_INVALID', 'A private exact original bound to the uploaded hash and bytes is required');
  }
  return descriptor;
};

export class ConflictError extends Error {
  constructor(code, current) {
    super(code);
    this.name = 'ConflictError';
    this.code = code;
    this.current = current;
  }
}

export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const CHECKPOINT_SLOTS = Object.freeze(['commit', 'work', 'reconcile']);
export const CHECKPOINT_STRATEGIES = Object.freeze([
  'initial-judgment', 'self-explanation', 'argument-reconstruction', 'evidence-warrant',
  'contrast-case', 'counterexample', 'consider-alternative', 'objection-repair',
  'question-generation', 'epistemic-calibration', 'framework-comparison', 'transfer',
  'metacognitive-trace'
]);
export const MEDIA_KINDS = Object.freeze(['image', 'animatedImage', 'shortVideo', 'audio', 'document']);
export const MEDIA_UPLOAD_POLICY = Object.freeze({
  totalStorageLimitBytes: 8 * 1024 * 1024 * 1024,
  monthlyIngestLimitBytes: 1024 * 1024 * 1024,
  derivativeReservationMultiplier: 4,
  ticketTtlSeconds: 15 * 60,
  mimeLimits: Object.freeze({
    'image/png': 15 * 1024 * 1024,
    'image/jpeg': 15 * 1024 * 1024,
    'image/gif': 25 * 1024 * 1024,
    'image/webp': 15 * 1024 * 1024,
    'audio/mpeg': 25 * 1024 * 1024,
    'audio/wav': 25 * 1024 * 1024,
    'audio/mp4': 25 * 1024 * 1024,
    'video/mp4': 25 * 1024 * 1024,
    'video/webm': 25 * 1024 * 1024,
    'application/pdf': 25 * 1024 * 1024,
    'text/plain': 5 * 1024 * 1024
  })
});
export const OPERATION_PAYLOAD_SCHEMAS = Object.freeze({
  'text.replace': { required: ['type', 'blockId', 'text'], optional: [] },
  'chapter.replaceBody': { required: ['type', 'body'], optional: [] },
  'block.insert': { required: ['type', 'block', 'position'], optional: [] },
  'block.move': { required: ['type', 'blockId', 'position'], optional: [] },
  'block.remove': { required: ['type', 'blockId'], optional: ['replacementPassageId'] },
  'checkpoint.upsert': { required: ['type', 'checkpoint'], optional: [] },
  'checkpoint.replace': { required: ['type', 'checkpoint'], optional: [] },
  'checkpoint.remove': { required: ['type', 'slot'], optional: ['checkpointId'] },
  'embed.upsert': { required: ['type', 'embed'], optional: ['position'] },
  'media.place': { required: ['type', 'placement'], optional: ['position'] },
  'media.remove': { required: ['type', 'figureId'], optional: [] }
});

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const requireString = (value, name, max = 4000) => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) throw new ApiError(422, 'VALIDATION_FAILED', `${name} must be a non-empty string of at most ${max} characters`, { path: name });
  return value.trim();
};
const safeText = (value, name, max = 4000) => {
  const text = requireString(value, name, max);
  if (/<\/?[a-z][^>]*>|javascript\s*:|(?:^|[;{])\s*(?:@import|[.#]?[a-z][^{}]*\{)/i.test(text)) throw new ApiError(422, 'RAW_MARKUP_FORBIDDEN', `${name} cannot contain HTML, scripts, or CSS`);
  return text;
};
const rejectUnknown = (value, allowed) => {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ApiError(400, 'UNKNOWN_FIELD', 'Request contains unknown fields', { fields: unknown });
};

export const trustedIdentity = (request) => {
  if (request.headers.get('x-content-gateway-verified') !== 'v1') throw new ApiError(401, 'UNAUTHENTICATED', 'Trusted gateway identity is required');
  const actorId = request.headers.get('x-content-actor-id');
  const actorType = request.headers.get('x-content-actor-type');
  const clientId = request.headers.get('x-content-client-id');
  if (!/^actor_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(actorId || '') || !['human', 'agent', 'service'].includes(actorType) || !clientId || actorId.length > 200 || clientId.length > 200) throw new ApiError(401, 'UNAUTHENTICATED', 'Gateway identity is incomplete');
  const scopes = new Set((request.headers.get('x-content-scopes') || '').split(/\s+/).filter(Boolean));
  return Object.freeze({ actorId, actorType, clientId, runId: request.headers.get('x-content-run-id') || null, scopes });
};

export const requireScope = (identity, scope) => {
  if (!identity.scopes.has(scope)) throw new ApiError(403, 'FORBIDDEN', `Scope ${scope} is required`);
};

export const readJsonBody = async (request, { maxBytes = 131072, allowedFields } = {}) => {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new ApiError(413, 'BODY_TOO_LARGE', `Body exceeds ${maxBytes} bytes`);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new ApiError(413, 'BODY_TOO_LARGE', `Body exceeds ${maxBytes} bytes`);
  let body;
  try { body = JSON.parse(text); } catch { throw new ApiError(400, 'INVALID_JSON', 'Body must be valid JSON'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'INVALID_BODY', 'Body must be a JSON object');
  if (allowedFields) rejectUnknown(body, allowedFields);
  return body;
};

export const validateUploadRequest = (body) => {
  rejectUnknown(body, ['filename', 'mimeType', 'bytes', 'sha256', 'idempotencyKey', 'transcriptEquivalent', 'poster', 'reviewPackageId']);
  const filename = requireString(body.filename, 'filename', 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(filename) || filename.includes('..')) throw new ApiError(422, 'FILENAME_INVALID', 'filename must be a sanitized basename');
  const maxBytes = MEDIA_UPLOAD_POLICY.mimeLimits[body.mimeType];
  if (!maxBytes) throw new ApiError(422, 'MIME_NOT_SUPPORTED', 'MIME type is not supported');
  if (!Number.isInteger(body.bytes) || body.bytes < 1 || body.bytes > maxBytes) throw new ApiError(413, 'FILE_TOO_LARGE', `File exceeds the ${maxBytes}-byte MIME limit`, { maxBytes });
  if (typeof body.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(body.sha256)) throw new ApiError(422, 'HASH_INVALID', 'sha256 must be a lowercase hexadecimal SHA-256');
  const reviewPackageId = requireString(body.reviewPackageId, 'reviewPackageId', 128);
  if (!/^reviewpkg_[a-f0-9]{24}$/.test(reviewPackageId)) throw new ApiError(422, 'REVIEW_PACKAGE_INVALID', 'reviewPackageId must be server-issued');
  if (body.transcriptEquivalent !== undefined) {
    if (!body.transcriptEquivalent || typeof body.transcriptEquivalent !== 'object' || Array.isArray(body.transcriptEquivalent)) throw new ApiError(422, 'TRANSCRIPT_EQUIVALENT_INVALID', 'transcriptEquivalent must be an object');
    rejectUnknown(body.transcriptEquivalent, ['provided', 'language', 'text']);
    if (body.transcriptEquivalent.provided !== true) throw new ApiError(422, 'TRANSCRIPT_EQUIVALENT_INVALID', 'transcriptEquivalent.provided must be true');
    requireString(body.transcriptEquivalent.language, 'transcriptEquivalent.language', 40);
    safeText(body.transcriptEquivalent.text, 'transcriptEquivalent.text', 50000);
  }
  if ((body.mimeType.startsWith('audio/') || body.mimeType.startsWith('video/')) && !body.transcriptEquivalent) throw new ApiError(422, 'TRANSCRIPT_EQUIVALENT_REQUIRED', 'Audio and video require a substantive transcript/equivalent; this does not claim timed caption-track support');
  if (body.mimeType.startsWith('video/') && (!body.poster || body.poster.provided !== true || typeof body.poster.alt !== 'string' || !body.poster.alt.trim())) throw new ApiError(422, 'POSTER_REQUIRED', 'Video requires a reviewed poster declaration');
  return { ...body, filename, reviewPackageId, maxBytes, storageReservationBytes: body.bytes * MEDIA_UPLOAD_POLICY.derivativeReservationMultiplier + 1024 * 1024 };
};

export const validateMediaReviewPackage = (body) => {
  rejectUnknown(body, ['rights', 'editorial', 'accessibility', 'idempotencyKey']);
  for (const name of ['rights', 'editorial', 'accessibility']) if (!body[name] || typeof body[name] !== 'object' || Array.isArray(body[name])) throw new ApiError(422, 'REVIEW_DECLARATION_REQUIRED', `${name} declaration is required`);
  rejectUnknown(body.rights, ['basis', 'creator', 'sourceUrl', 'license', 'attribution', 'permissionEvidenceRef', 'notes']);
  if (!['owned', 'licensed', 'permission', 'publicDomain', 'fairUse', 'unknown'].includes(body.rights.basis)) throw new ApiError(422, 'RIGHTS_BASIS_INVALID', 'rights.basis is invalid');
  const rights = { basis: body.rights.basis, creator: safeText(body.rights.creator, 'rights.creator', 300), attribution: safeText(body.rights.attribution, 'rights.attribution', 1000) };
  if (body.rights.sourceUrl) rights.sourceUrl = publicHttpsUrl(body.rights.sourceUrl, 'rights.sourceUrl');
  if (body.rights.license) rights.license = safeText(body.rights.license, 'rights.license', 300);
  if (body.rights.permissionEvidenceRef) rights.permissionEvidenceRef = requireString(body.rights.permissionEvidenceRef, 'rights.permissionEvidenceRef', 300);
  if (body.rights.notes) rights.notes = safeText(body.rights.notes, 'rights.notes', 2000);
  rejectUnknown(body.editorial, ['teachingUse', 'placementIntent', 'notes']);
  const editorial = { teachingUse: safeText(body.editorial.teachingUse, 'editorial.teachingUse', 2000), placementIntent: safeText(body.editorial.placementIntent, 'editorial.placementIntent', 1000), ...(body.editorial.notes ? { notes: safeText(body.editorial.notes, 'editorial.notes', 2000) } : {}) };
  rejectUnknown(body.accessibility, ['decorative', 'altText', 'transcriptEquivalent', 'motionReview', 'notes']);
  if (typeof body.accessibility.decorative !== 'boolean') throw new ApiError(422, 'ACCESSIBILITY_DECLARATION_INVALID', 'accessibility.decorative must be boolean');
  const accessibility = { decorative: body.accessibility.decorative, motionReview: body.accessibility.motionReview || 'notApplicable' };
  if (!['notApplicable', 'pending', 'passed', 'failed'].includes(accessibility.motionReview)) throw new ApiError(422, 'ACCESSIBILITY_DECLARATION_INVALID', 'accessibility.motionReview is invalid');
  if (!accessibility.decorative) accessibility.altText = safeText(body.accessibility.altText, 'accessibility.altText', 1000);
  if (body.accessibility.transcriptEquivalent !== undefined) {
    const value = body.accessibility.transcriptEquivalent;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(422, 'TRANSCRIPT_EQUIVALENT_INVALID', 'accessibility.transcriptEquivalent must be an object');
    rejectUnknown(value, ['language', 'text']);
    accessibility.transcriptEquivalent = { language: requireString(value.language, 'accessibility.transcriptEquivalent.language', 40), text: safeText(value.text, 'accessibility.transcriptEquivalent.text', 50000) };
  }
  if (body.accessibility.notes) accessibility.notes = safeText(body.accessibility.notes, 'accessibility.notes', 2000);
  return { rights, editorial, accessibility };
};

export const assertMediaBudget = ({ storedBytes = 0, reservedStorageBytes = 0, monthlyIngestedBytes = 0, monthlyReservedBytes = 0 }, upload) => {
  if (storedBytes + reservedStorageBytes + upload.storageReservationBytes > MEDIA_UPLOAD_POLICY.totalStorageLimitBytes) throw new ApiError(429, 'STORAGE_BUDGET_EXCEEDED', 'The 8 GiB media storage guard would be exceeded');
  if (monthlyIngestedBytes + monthlyReservedBytes + upload.bytes > MEDIA_UPLOAD_POLICY.monthlyIngestLimitBytes) throw new ApiError(429, 'MONTHLY_INGEST_BUDGET_EXCEEDED', 'The 1 GiB monthly ingest guard would be exceeded');
};

export const hmacSha256 = async (secret, value) => {
  if (typeof secret !== 'string' || secret.length < 32) throw new ApiError(503, 'CALLBACK_SECRET_UNAVAILABLE', 'Processor callback secret is unavailable');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const verifyHmacSignature = async (secret, value, header) => {
  if (typeof header !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(header)) return false;
  const expected = await hmacSha256(secret, value);
  const actual = header.slice(7);
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return mismatch === 0;
};

export const finalizeChapterRevision = async (chapter, { editorialContentHash, status, actorId, actorType, updatedAt }) => {
  if (!/^[a-f0-9]{64}$/.test(editorialContentHash || '')) throw new ApiError(422, 'HASH_INVALID', 'editorialContentHash must be SHA-256');
  if (!['inReview', 'published'].includes(status)) throw new ApiError(422, 'CHAPTER_STATUS_INVALID', 'Finalized chapter status is invalid');
  if (!/^actor_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(actorId || '') || !['human', 'agent', 'service'].includes(actorType)) throw new ApiError(422, 'ACTOR_INVALID', 'Finalized revision actor is invalid');
  const revisionId = `revision_${editorialContentHash.slice(0, 24)}`;
  const content = { ...structuredClone(chapter), revisionId, chapterVersion: revisionId, status, updatedBy: { actorId, actorType }, updatedAt };
  return { revisionId, editorialContentHash, content, contentHash: await sha256(content) };
};

const passageIds = (chapter) => new Set([
  ...(Array.isArray(chapter.passages) ? chapter.passages.map((item) => item?.passageId) : []),
  ...(Array.isArray(chapter.body) ? chapter.body.map((item) => item?.passageId) : [])
].filter(Boolean));

const normalizeCheckpoint = async (chapter, input, existing = null) => {
  rejectUnknown(input, ['checkpointId', 'legacyId', 'passageId', 'passageExcerptHash', 'slot', 'stage', 'strategy', 'title', 'trigger', 'prompt', 'guidance', 'responseStructure', 'minWords', 'maxWords', 'rationale', 'showInSidebar']);
  if (!CHECKPOINT_SLOTS.includes(input.slot)) throw new ApiError(422, 'CHECKPOINT_SLOT_INVALID', 'Checkpoint slot must be commit, work, or reconcile');
  if (!CHECKPOINT_STRATEGIES.includes(input.strategy)) throw new ApiError(422, 'CHECKPOINT_STRATEGY_INVALID', 'Checkpoint strategy is unsupported');
  const passageId = requireString(input.passageId, 'checkpoint.passageId', 200);
  if (!passageIds(chapter).has(passageId)) throw new ApiError(422, 'CHECKPOINT_ANCHOR_MISSING', 'Checkpoint passage anchor does not exist', { passageId });
  if (typeof input.showInSidebar !== 'boolean') throw new ApiError(422, 'CHECKPOINT_SIDEBAR_INVALID', 'showInSidebar must be boolean');
  if (!['prose', 'movement-plus-prose'].includes(input.responseStructure)) throw new ApiError(422, 'CHECKPOINT_RESPONSE_STRUCTURE_INVALID', 'Unsupported checkpoint response structure');
  if (!Number.isInteger(input.minWords) || !Number.isInteger(input.maxWords) || input.minWords < 1 || input.maxWords > 1000 || input.minWords > input.maxWords) throw new ApiError(422, 'CHECKPOINT_RESPONSE_RANGE_INVALID', 'Checkpoint response word range is invalid');
  if (!existing && input.checkpointId !== undefined) throw new ApiError(422, 'CHECKPOINT_ID_SERVER_ASSIGNED', 'New checkpoint IDs are assigned by the server');
  if (existing && input.checkpointId !== undefined && input.checkpointId !== existing.checkpointId) throw new ApiError(422, 'CHECKPOINT_ID_IMMUTABLE', 'Checkpoint ID cannot be changed');
  const checkpointId = existing?.checkpointId || await deterministicId('checkpoint', { chapterId: chapter.chapterId, slot: input.slot });
  return {
    checkpointId,
    ...(input.legacyId ? { legacyId: requireString(input.legacyId, 'checkpoint.legacyId', 200) } : {}),
    passageId,
    passageExcerptHash: requireString(input.passageExcerptHash, 'checkpoint.passageExcerptHash', 64),
    slot: input.slot,
    stage: requireString(input.stage, 'checkpoint.stage', 120),
    strategy: input.strategy,
    title: requireString(input.title, 'checkpoint.title', 200),
    trigger: requireString(input.trigger, 'checkpoint.trigger', 300),
    prompt: requireString(input.prompt, 'checkpoint.prompt', 4000),
    guidance: requireString(input.guidance, 'checkpoint.guidance', 2000),
    responseStructure: input.responseStructure,
    minWords: input.minWords,
    maxWords: input.maxWords,
    rationale: requireString(input.rationale, 'checkpoint.rationale', 2000),
    showInSidebar: input.showInSidebar
  };
};

const bodyBlocks = (chapter) => {
  if (!Array.isArray(chapter.body)) throw new ApiError(422, 'CHAPTER_BODY_INVALID', 'Chapter body must be an array');
  return chapter.body;
};
const findUniqueBlock = (chapter, blockId) => {
  requireString(blockId, 'blockId', 200);
  const matches = bodyBlocks(chapter).map((block, index) => ({ block, index })).filter((item) => item.block?.blockId === blockId);
  if (matches.length === 0) throw new ApiError(404, 'BLOCK_NOT_FOUND', 'Block does not exist');
  if (matches.length > 1) throw new ApiError(409, 'BLOCK_ID_DUPLICATE', 'Block identity is not unique');
  return matches[0];
};
const placementIndex = (chapter, position) => {
  if (!position || typeof position !== 'object' || Array.isArray(position)) throw new ApiError(422, 'POSITION_REQUIRED', 'A stable block position is required');
  rejectUnknown(position, ['beforeBlockId', 'afterBlockId']);
  const before = own(position, 'beforeBlockId');
  const after = own(position, 'afterBlockId');
  if (before === after) throw new ApiError(422, 'POSITION_INVALID', 'Specify exactly one of beforeBlockId or afterBlockId');
  const anchor = findUniqueBlock(chapter, before ? position.beforeBlockId : position.afterBlockId);
  return before ? anchor.index : anchor.index + 1;
};
const assertUniqueBodyIds = (chapter, candidate) => {
  const blocks = bodyBlocks(chapter);
  for (const field of ['blockId', 'passageId', 'sectionId', 'figureId', 'embedId', 'linkId']) {
    if (candidate[field] && blocks.some((item) => item[field] === candidate[field])) throw new ApiError(409, 'STABLE_ID_CONFLICT', `${field} already exists`, { field, id: candidate[field] });
  }
};

const normalizeInsertedBlock = async (chapter, input, position) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'INVALID_OPERATION', 'block payload is required');
  const allowed = {
    paragraph: ['type', 'text'], heading: ['type', 'text', 'level'], blockquote: ['type', 'text'], callout: ['type', 'text', 'tone'],
    list: ['type', 'ordered', 'items'], codeBlock: ['type', 'code', 'language'], table: ['type', 'rows'], diagram: ['type', 'diagramId', 'alt']
  };
  if (input.type === 'legacyMarkup' || input.type === 'externalEmbed' || input.type === 'richLink' || input.type === 'mediaFigure') throw new ApiError(422, 'BLOCK_TYPE_FORBIDDEN', 'Use the dedicated typed operation for this block type');
  if (!allowed[input.type]) throw new ApiError(422, 'BLOCK_TYPE_UNSUPPORTED', 'Block type is not supported by block.insert');
  rejectUnknown(input, allowed[input.type]);
  const identitySeed = { chapterId: chapter.chapterId, position, block: input };
  const blockId = await deterministicId('block', identitySeed);
  const passageId = await deterministicId('passage', identitySeed);
  let block;
  if (['paragraph', 'blockquote'].includes(input.type)) block = { type: input.type, blockId, passageId, text: safeText(input.text, 'block.text', 50000) };
  else if (input.type === 'heading') {
    if (!Number.isInteger(input.level) || input.level < 2 || input.level > 6) throw new ApiError(422, 'HEADING_LEVEL_INVALID', 'Heading level must be 2 through 6');
    block = { type: 'heading', blockId, passageId, sectionId: await deterministicId('section', identitySeed), level: input.level, text: safeText(input.text, 'block.text', 1000) };
  } else if (input.type === 'callout') {
    if (!['note', 'warning', 'example', 'question'].includes(input.tone)) throw new ApiError(422, 'CALLOUT_TONE_INVALID', 'Callout tone is invalid');
    block = { type: 'callout', blockId, passageId, tone: input.tone, text: safeText(input.text, 'block.text', 20000) };
  } else if (input.type === 'list') {
    if (typeof input.ordered !== 'boolean' || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) throw new ApiError(422, 'LIST_INVALID', 'List requires ordered and 1 to 100 items');
    block = { type: 'list', blockId, passageId, ordered: input.ordered, items: input.items.map((item, index) => safeText(item, `block.items.${index}`, 4000)) };
  } else if (input.type === 'codeBlock') block = { type: 'codeBlock', blockId, passageId, code: requireString(input.code, 'block.code', 50000), ...(input.language ? { language: requireString(input.language, 'block.language', 50) } : {}) };
  else if (input.type === 'table') {
    if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 100 || input.rows.some((row) => !Array.isArray(row) || row.length < 1 || row.length > 20)) throw new ApiError(422, 'TABLE_INVALID', 'Table dimensions are invalid');
    block = { type: 'table', blockId, passageId, rows: input.rows.map((row, r) => row.map((cell, c) => safeText(cell, `block.rows.${r}.${c}`, 4000))) };
  } else block = { type: 'diagram', blockId, passageId, diagramId: requireString(input.diagramId, 'block.diagramId', 200), alt: safeText(input.alt, 'block.alt', 1000) };
  assertUniqueBodyIds(chapter, block);
  return block;
};

const editableBodyTypes = new Set(['paragraph', 'heading', 'blockquote', 'callout', 'list', 'codeBlock', 'table']);
const visualStyleTypes = new Set(['paragraph', 'heading', 'blockquote', 'callout', 'list']);
const normalizeExistingEditableBlock = async (existing, input, index) => {
  if (input.blockId !== existing.blockId) throw new ApiError(422, 'STABLE_ID_CHANGE_FORBIDDEN', 'Existing block identity cannot be changed', { index });
  if (input.type !== existing.type) {
    if (!visualStyleTypes.has(existing.type) || !visualStyleTypes.has(input.type)) throw new ApiError(422, 'BLOCK_TYPE_CHANGE_UNSUPPORTED', 'Only paragraph, heading, quote, callout, and list styles can be changed in the visual editor', { blockId: existing.blockId, index });
    if (input.type === 'heading') {
      if (!Number.isInteger(input.level) || input.level < 2 || input.level > 6) throw new ApiError(422, 'HEADING_LEVEL_INVALID', 'Heading level must be 2 through 6', { index });
      return { type: 'heading', blockId: existing.blockId, sectionId: existing.sectionId || await deterministicId('section', { blockId: existing.blockId, type: 'heading' }), level: input.level, text: safeText(input.text, `body.${index}.text`, 1000) };
    }
    const passageId = existing.passageId || await deterministicId('passage', { blockId: existing.blockId, type: input.type });
    if (input.type === 'list') {
      if (typeof input.ordered !== 'boolean' || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) throw new ApiError(422, 'LIST_INVALID', 'List requires ordered and 1 to 100 items', { index });
      const items = input.items.map((item, itemIndex) => safeText(item, `body.${index}.items.${itemIndex}`, 4000));
      return { type: 'list', blockId: existing.blockId, passageId, ordered: input.ordered, text: items.join(' '), items };
    }
    if (input.type === 'callout') {
      if (!['note', 'warning', 'example', 'question'].includes(input.tone)) throw new ApiError(422, 'CALLOUT_TONE_INVALID', 'Callout tone is invalid', { index });
      return { type: 'callout', blockId: existing.blockId, passageId, tone: input.tone, text: safeText(input.text, `body.${index}.text`, 20000) };
    }
    return { type: input.type, blockId: existing.blockId, passageId, text: safeText(input.text, `body.${index}.text`, 50000) };
  }
  if (['paragraph', 'heading', 'blockquote', 'callout'].includes(existing.type)) {
    const limit = existing.type === 'heading' ? 1000 : existing.type === 'callout' ? 20000 : 50000;
    return { ...existing, text: safeText(input.text, `body.${index}.text`, limit) };
  }
  if (existing.type === 'list') {
    if (typeof input.ordered !== 'boolean' || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) throw new ApiError(422, 'LIST_INVALID', 'List requires ordered and 1 to 100 items', { index });
    const items = input.items.map((item, itemIndex) => safeText(item, `body.${index}.items.${itemIndex}`, 4000));
    return { ...existing, ordered: input.ordered, text: items.join(' '), items };
  }
  if (existing.type === 'codeBlock') return { ...existing, code: requireString(input.code, `body.${index}.code`, 50000), ...(input.language ? { language: requireString(input.language, `body.${index}.language`, 50) } : {}) };
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 100 || input.rows.some((row) => !Array.isArray(row) || row.length < 1 || row.length > 20)) throw new ApiError(422, 'TABLE_INVALID', 'Table dimensions are invalid', { index });
  return { ...existing, rows: input.rows.map((row, rowIndex) => row.map((cell) => safeText(cell, `body.${index}.rows.${rowIndex}`, 4000))) };
};

const normalizeChapterBodyReplacement = async (chapter, input) => {
  if (!Array.isArray(input) || input.length < 1 || input.length > 2000) throw new ApiError(422, 'CHAPTER_BODY_INVALID', 'body must contain 1 to 2000 structured blocks');
  const originals = new Map(bodyBlocks(chapter).map((block) => [block.blockId, block]));
  const used = new Set();
  const scratch = { ...chapter, body: [] };
  for (let index = 0; index < input.length; index += 1) {
    const candidate = input[index];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new ApiError(422, 'CHAPTER_BODY_INVALID', 'Every body item must be an object', { index });
    let normalized;
    if (candidate.blockId) {
      if (used.has(candidate.blockId)) throw new ApiError(409, 'BLOCK_ID_DUPLICATE', 'A block can appear only once in a chapter replacement', { blockId: candidate.blockId });
      const existing = originals.get(candidate.blockId);
      if (!existing) throw new ApiError(422, 'CLIENT_ASSIGNED_ID_FORBIDDEN', 'New blocks cannot choose their own stable IDs', { index });
      used.add(candidate.blockId);
      if (candidate.preserve === true) {
        rejectUnknown(candidate, ['blockId', 'preserve']);
        normalized = structuredClone(existing);
      } else {
        if (!editableBodyTypes.has(existing.type)) throw new ApiError(422, 'STRUCTURED_BLOCK_REQUIRES_PRESERVE', 'Media, embeds, diagrams, and legacy content must be preserved or changed with their dedicated controls', { blockId: existing.blockId });
        normalized = await normalizeExistingEditableBlock(existing, candidate, index);
      }
    } else {
      if (candidate.preserve !== undefined) throw new ApiError(422, 'PRESERVE_REQUIRES_BLOCK_ID', 'preserve requires an existing blockId', { index });
      const previous = scratch.body.at(-1)?.blockId;
      if (!previous) throw new ApiError(422, 'FIRST_BLOCK_ID_REQUIRED', 'A full chapter replacement must retain its first stable block');
      normalized = await normalizeInsertedBlock(scratch, candidate, { afterBlockId: previous });
    }
    assertUniqueBodyIds(scratch, normalized);
    scratch.body.push(normalized);
  }
  const anchors = passageIds(scratch);
  const missing = [];
  for (const checkpoint of chapter.checkpoints || []) if (!anchors.has(checkpoint.passageId)) missing.push({ kind: 'checkpoint', id: checkpoint.checkpointId, passageId: checkpoint.passageId });
  for (const annotation of chapter.annotations || []) if (!anchors.has(annotation.passageId)) missing.push({ kind: 'annotation', id: annotation.annotationId, passageId: annotation.passageId });
  for (const block of scratch.body) if (block.anchorPassageId && !anchors.has(block.anchorPassageId)) missing.push({ kind: block.type, id: block.blockId, passageId: block.anchorPassageId });
  if (missing.length) throw new ApiError(409, 'DEPENDENCIES_REQUIRE_REANCHOR', 'The pasted chapter would orphan anchored content; keep those passages or reanchor them first', { dependents: missing });
  chapter.body = scratch.body;
  chapter.checkpoints = await Promise.all((chapter.checkpoints || []).map(async (checkpoint) => {
    const block = chapter.body.find((item) => item.passageId === checkpoint.passageId);
    const excerpt = block?.text || block?.items?.join(' ') || '';
    return excerpt ? { ...checkpoint, passageExcerptHash: await sha256(excerpt) } : checkpoint;
  }));
};

const PUBLIC_EMBED_HOSTS = Object.freeze({
  youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'], vimeo: ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'], spotify: ['open.spotify.com'],
  soundcloud: ['soundcloud.com', 'www.soundcloud.com'], bluesky: ['bsky.app']
});
const PROVIDER_RESOURCE_TYPES = Object.freeze({ youtube: ['video', 'playlist'], vimeo: ['video'], x: ['post'], spotify: ['artist', 'album', 'track', 'show', 'episode'], soundcloud: ['user', 'set', 'track'], bluesky: ['post'] });
const PROVIDER_SAFE_OPTIONS = Object.freeze({ youtube: Object.freeze({ captions: true }), vimeo: Object.freeze({ dnt: true }), x: Object.freeze({ conversation: true }), spotify: Object.freeze({ consent: true }), soundcloud: Object.freeze({ linkFirst: true }), bluesky: Object.freeze({ linkFirst: true }) });
export const PROVIDER_REGISTRY = Object.freeze(Object.fromEntries(Object.keys(PUBLIC_EMBED_HOSTS).map((provider) => [provider, Object.freeze({
  hosts: Object.freeze([...PUBLIC_EMBED_HOSTS[provider]]), resourceTypes: Object.freeze([...PROVIDER_RESOURCE_TYPES[provider]]), adapterVersion: `${provider}-v1`, safeOptions: PROVIDER_SAFE_OPTIONS[provider]
})])));
const publicHttpsUrl = (value, name, allowedHosts = null) => {
  let url;
  try { url = new URL(value); } catch { throw new ApiError(422, 'URL_INVALID', `${name} must be a valid URL`); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') || host === 'localhost' || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || /(?:^|\.)(?:local|internal|localhost)$/.test(host)) throw new ApiError(422, 'URL_NOT_PUBLIC_HTTPS', `${name} must be a public HTTPS URL`);
  if (allowedHosts && !allowedHosts.includes(host)) throw new ApiError(422, 'PROVIDER_IDENTITY_MISMATCH', 'URL host does not match provider identity');
  return url.toString();
};

const providerForHost = (host) => Object.entries(PUBLIC_EMBED_HOSTS).find(([, hosts]) => hosts.includes(host))?.[0] || null;
const providerResourceId = (value, name = 'provider resource ID') => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:@-]{1,300}$/.test(value)) throw new ApiError(422, 'PROVIDER_URL_INVALID', `${name} is missing or invalid`);
  return value;
};

/** Resolve only locally recognizable provider identities. This function never performs DNS or HTTP requests. */
export const resolveProviderUrl = (inputUrl, expectedProvider = undefined) => {
  const canonicalInput = publicHttpsUrl(inputUrl, 'url');
  if (canonicalInput.length > 2048) throw new ApiError(422, 'URL_TOO_LONG', 'url must be at most 2048 characters');
  const url = new URL(canonicalInput);
  url.hash = '';
  const provider = providerForHost(url.hostname.toLowerCase());
  if (expectedProvider !== undefined && (!PROVIDER_REGISTRY[expectedProvider] || expectedProvider !== provider)) throw new ApiError(422, 'PROVIDER_IDENTITY_MISMATCH', 'URL host does not match expectedProvider');
  if (!provider) return {
    kind: 'richLink', canonicalUrl: url.toString(), supportedProvider: false, networkAccess: false,
    warnings: ['No approved provider adapter matched; use an instructor-authored rich-link fallback.'],
    requiredFallbackFields: ['title', 'summary', 'linkLabel', 'accessedAt']
  };

  let segments;
  try { segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment)); }
  catch { throw new ApiError(422, 'PROVIDER_URL_INVALID', 'Provider URL path encoding is invalid'); }
  let resourceType;
  let resourceId;
  let canonicalUrl;
  let unlistedHash;
  if (provider === 'youtube') {
    if (url.hostname === 'youtu.be') { resourceType = 'video'; resourceId = segments[0]; }
    else if (url.searchParams.get('v')) { resourceType = 'video'; resourceId = url.searchParams.get('v'); }
    else if (url.searchParams.get('list')) { resourceType = 'playlist'; resourceId = url.searchParams.get('list'); }
    else if (['embed', 'shorts', 'live'].includes(segments[0]) && segments[1]) { resourceType = 'video'; resourceId = segments[1]; }
    resourceId = providerResourceId(resourceId);
    canonicalUrl = resourceType === 'playlist' ? `https://www.youtube.com/playlist?list=${encodeURIComponent(resourceId)}` : `https://www.youtube.com/watch?v=${encodeURIComponent(resourceId)}`;
  } else if (provider === 'vimeo') {
    const numericIndex = segments.findIndex((segment) => /^\d+$/.test(segment));
    if (numericIndex < 0) throw new ApiError(422, 'PROVIDER_URL_INVALID', 'Vimeo URL must contain a numeric video ID');
    resourceType = 'video'; resourceId = providerResourceId(segments[numericIndex]);
    if (segments[numericIndex + 1]) unlistedHash = providerResourceId(segments[numericIndex + 1], 'Vimeo unlisted hash');
    canonicalUrl = `https://vimeo.com/${resourceId}${unlistedHash ? `/${unlistedHash}` : ''}`;
  } else if (provider === 'x') {
    const statusIndex = segments.indexOf('status');
    if (statusIndex < 1 || !segments[statusIndex + 1]) throw new ApiError(422, 'PROVIDER_URL_INVALID', 'X URL must be a canonical public status URL');
    const account = providerResourceId(segments[statusIndex - 1], 'X account');
    resourceType = 'post'; resourceId = providerResourceId(segments[statusIndex + 1], 'X post ID');
    canonicalUrl = `https://x.com/${account}/status/${resourceId}`;
  } else if (provider === 'spotify') {
    if (segments.length < 2 || !PROVIDER_RESOURCE_TYPES.spotify.includes(segments[0])) throw new ApiError(422, 'PROVIDER_URL_INVALID', 'Spotify URL must contain a supported resource type and ID');
    resourceType = segments[0]; resourceId = providerResourceId(segments[1]); canonicalUrl = `https://open.spotify.com/${resourceType}/${resourceId}`;
  } else if (provider === 'soundcloud') {
    if (segments.length === 1) { resourceType = 'user'; resourceId = providerResourceId(segments[0]); }
    else if (segments.length >= 3 && segments[1] === 'sets') { resourceType = 'set'; resourceId = providerResourceId(segments[2]); }
    else if (segments.length >= 2) { resourceType = 'track'; resourceId = providerResourceId(segments[1]); }
    else throw new ApiError(422, 'PROVIDER_URL_INVALID', 'SoundCloud URL is missing a resource path');
    canonicalUrl = url.toString();
  } else {
    if (segments[0] !== 'profile' || segments[2] !== 'post' || !segments[1] || !segments[3]) throw new ApiError(422, 'PROVIDER_URL_INVALID', 'Bluesky URL must be a public profile post URL');
    resourceType = 'post'; resourceId = providerResourceId(segments[3]); canonicalUrl = `https://bsky.app/profile/${segments[1]}/post/${segments[3]}`;
  }
  return {
    kind: 'externalEmbed', supportedProvider: true, canonicalUrl, identity: { provider, resourceType, resourceId, ...(unlistedHash ? { unlistedHash } : {}) },
    adapterVersion: PROVIDER_REGISTRY[provider].adapterVersion, networkAccess: false, health: 'unchecked',
    warnings: ['Availability and mutable provider metadata have not been fetched; authored fallback remains required.'],
    requiredFallbackFields: ['title', 'summary', 'linkLabel', 'accessedAt']
  };
};
const authoredFallback = (value, name = 'embed.fallback') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(422, 'FALLBACK_REQUIRED', 'Authored fallback is required');
  rejectUnknown(value, ['title', 'summary', 'posterAssetId', 'transcript', 'linkLabel', 'creator', 'publishedAt', 'accessedAt']);
  return { title: safeText(value.title, `${name}.title`, 300), summary: safeText(value.summary, `${name}.summary`, 4000), linkLabel: safeText(value.linkLabel, `${name}.linkLabel`, 120), accessedAt: requireString(value.accessedAt, `${name}.accessedAt`, 40), ...(value.posterAssetId ? { posterAssetId: requireString(value.posterAssetId, `${name}.posterAssetId`, 200) } : {}), ...(value.transcript ? { transcript: safeText(value.transcript, `${name}.transcript`, 20000) } : {}), ...(value.creator ? { creator: safeText(value.creator, `${name}.creator`, 300) } : {}), ...(value.publishedAt ? { publishedAt: requireString(value.publishedAt, `${name}.publishedAt`, 40) } : {}) };
};

const normalizeEmbed = async (chapter, input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'INVALID_OPERATION', 'embed payload is required');
  if (input.kind === 'externalEmbed') {
    rejectUnknown(input, ['kind', 'embedId', 'anchorPassageId', 'identity', 'canonicalUrl', 'caption', 'teachingUse', 'displayPreset', 'theme', 'fallback', 'adapterVersion']);
    if (!input.identity || typeof input.identity !== 'object') throw new ApiError(422, 'PROVIDER_IDENTITY_REQUIRED', 'Provider identity is required');
    rejectUnknown(input.identity, ['provider', 'resourceType', 'resourceId', 'unlistedHash']);
    if (!PUBLIC_EMBED_HOSTS[input.identity.provider]) throw new ApiError(422, 'PROVIDER_NOT_SUPPORTED', 'Provider is unsupported');
    const canonicalUrl = publicHttpsUrl(input.canonicalUrl, 'embed.canonicalUrl', PUBLIC_EMBED_HOSTS[input.identity.provider]);
    if (!PROVIDER_RESOURCE_TYPES[input.identity.provider].includes(input.identity.resourceType)) throw new ApiError(422, 'PROVIDER_IDENTITY_INVALID', 'Provider resourceType is invalid');
    const resourceId = requireString(input.identity.resourceId, 'embed.identity.resourceId', 300);
    if (!/^[A-Za-z0-9._:@-]+$/.test(resourceId)) throw new ApiError(422, 'PROVIDER_IDENTITY_INVALID', 'Provider resourceId is invalid');
    if (!canonicalUrl.includes(resourceId) && !canonicalUrl.includes(encodeURIComponent(resourceId))) throw new ApiError(422, 'PROVIDER_IDENTITY_MISMATCH', 'Canonical URL does not contain the declared resource identity');
    const existing = input.embedId ? bodyBlocks(chapter).find((item) => item.type === 'externalEmbed' && item.embedId === input.embedId) : null;
    if (input.embedId && !existing) throw new ApiError(404, 'EMBED_NOT_FOUND', 'External embed does not exist');
    const anchorPassageId = input.anchorPassageId ? requireString(input.anchorPassageId, 'embed.anchorPassageId', 200) : undefined;
    if (anchorPassageId && !passageIds(chapter).has(anchorPassageId)) throw new ApiError(422, 'EMBED_ANCHOR_MISSING', 'Embed anchor passage does not exist');
    const embedId = existing?.embedId || await deterministicId('embed', { chapterId: chapter.chapterId, identity: input.identity, canonicalUrl });
    const blockId = existing?.blockId || await deterministicId('block', { chapterId: chapter.chapterId, embedId });
    if (input.adapterVersion !== PROVIDER_REGISTRY[input.identity.provider].adapterVersion) throw new ApiError(422, 'ADAPTER_VERSION_INVALID', 'Embed adapterVersion must match the server provider registry');
    const block = { type: 'externalEmbed', embedId, blockId, ...(anchorPassageId ? { anchorPassageId } : {}), identity: { provider: input.identity.provider, resourceType: input.identity.resourceType, resourceId, ...(input.identity.unlistedHash ? { unlistedHash: requireString(input.identity.unlistedHash, 'embed.identity.unlistedHash', 200) } : {}) }, canonicalUrl, caption: safeText(input.caption, 'embed.caption', 2000), teachingUse: safeText(input.teachingUse, 'embed.teachingUse', 2000), displayPreset: ['compact', 'reading', 'wide'].includes(input.displayPreset) ? input.displayPreset : (() => { throw new ApiError(422, 'DISPLAY_PRESET_INVALID', 'Embed displayPreset is invalid'); })(), theme: ['light', 'dark', 'auto'].includes(input.theme) ? input.theme : (() => { throw new ApiError(422, 'THEME_INVALID', 'Embed theme is invalid'); })(), options: PROVIDER_SAFE_OPTIONS[input.identity.provider], fallback: authoredFallback(input.fallback), adapterVersion: input.adapterVersion };
    if (!existing) assertUniqueBodyIds(chapter, block);
    return { block, existing };
  }
  if (input.kind === 'richLink') {
    rejectUnknown(input, ['kind', 'linkId', 'anchorPassageId', 'canonicalUrl', 'title', 'summary', 'teachingUse', 'linkLabel', 'posterMediaVersionId', 'accessedAt']);
    const existing = input.linkId ? bodyBlocks(chapter).find((item) => item.type === 'richLink' && item.linkId === input.linkId) : null;
    if (input.linkId && !existing) throw new ApiError(404, 'EMBED_NOT_FOUND', 'Rich link does not exist');
    const canonicalUrl = publicHttpsUrl(input.canonicalUrl, 'embed.canonicalUrl');
    const anchorPassageId = input.anchorPassageId ? requireString(input.anchorPassageId, 'embed.anchorPassageId', 200) : undefined;
    if (anchorPassageId && !passageIds(chapter).has(anchorPassageId)) throw new ApiError(422, 'EMBED_ANCHOR_MISSING', 'Link anchor passage does not exist');
    const linkId = existing?.linkId || await deterministicId('link', { chapterId: chapter.chapterId, canonicalUrl });
    const blockId = existing?.blockId || await deterministicId('block', { chapterId: chapter.chapterId, linkId });
    const block = { type: 'richLink', linkId, blockId, ...(anchorPassageId ? { anchorPassageId } : {}), canonicalUrl, title: safeText(input.title, 'embed.title', 300), summary: safeText(input.summary, 'embed.summary', 4000), teachingUse: safeText(input.teachingUse, 'embed.teachingUse', 2000), linkLabel: safeText(input.linkLabel, 'embed.linkLabel', 120), ...(input.posterMediaVersionId ? { posterMediaVersionId: requireString(input.posterMediaVersionId, 'embed.posterMediaVersionId', 200) } : {}), accessedAt: requireString(input.accessedAt, 'embed.accessedAt', 40) };
    if (!existing) assertUniqueBodyIds(chapter, block);
    return { block, existing };
  }
  throw new ApiError(422, 'EMBED_KIND_INVALID', 'embed.kind must be externalEmbed or richLink');
};

const normalizeMediaPlacement = async (chapter, input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'INVALID_OPERATION', 'placement payload is required');
  rejectUnknown(input, ['figureId', 'mediaId', 'mediaVersionId', 'rightsCaseId', 'anchorPassageId', 'decorative', 'alt', 'caption', 'captionOmissionReason', 'teachingUse', 'creditOverride', 'displayPreset', 'align', 'animationPolicy', 'printPolicy', 'downloadable']);
  const existing = input.figureId ? bodyBlocks(chapter).find((item) => item.type === 'mediaFigure' && item.figureId === input.figureId) : null;
  if (input.figureId && !existing) throw new ApiError(404, 'MEDIA_PLACEMENT_NOT_FOUND', 'Media placement does not exist');
  if (typeof input.decorative !== 'boolean' || typeof input.downloadable !== 'boolean') throw new ApiError(422, 'MEDIA_SEMANTICS_INVALID', 'decorative and downloadable must be boolean');
  if (!input.decorative && !input.alt) throw new ApiError(422, 'MEDIA_ALT_REQUIRED', 'Non-decorative media requires alt text');
  if (input.caption && input.captionOmissionReason) throw new ApiError(422, 'MEDIA_CAPTION_CONFLICT', 'Provide caption or captionOmissionReason, not both');
  if (!input.caption && !input.captionOmissionReason) throw new ApiError(422, 'MEDIA_CAPTION_REQUIRED', 'Provide caption or an omission reason');
  if (!['narrow', 'reading', 'wide', 'bleed'].includes(input.displayPreset) || !['start', 'center', 'end'].includes(input.align) || !['poster', 'firstFrame', 'omit'].includes(input.printPolicy)) throw new ApiError(422, 'MEDIA_PRESENTATION_INVALID', 'Media display, alignment, or print policy is invalid');
  if (input.animationPolicy !== undefined && !['clickToPlay', 'playOnce', 'loopWithControls'].includes(input.animationPolicy)) throw new ApiError(422, 'MEDIA_ANIMATION_INVALID', 'Media animation policy is invalid');
  const anchorPassageId = input.anchorPassageId ? requireString(input.anchorPassageId, 'placement.anchorPassageId', 200) : undefined;
  if (anchorPassageId && !passageIds(chapter).has(anchorPassageId)) throw new ApiError(422, 'MEDIA_ANCHOR_MISSING', 'Media anchor passage does not exist');
  const identitySeed = { chapterId: chapter.chapterId, mediaId: input.mediaId, mediaVersionId: input.mediaVersionId, rightsCaseId: input.rightsCaseId, anchorPassageId };
  const figureId = existing?.figureId || await deterministicId('figure', identitySeed);
  const blockId = existing?.blockId || await deterministicId('block', { chapterId: chapter.chapterId, figureId });
  const block = { type: 'mediaFigure', figureId, blockId, mediaId: requireString(input.mediaId, 'placement.mediaId', 200), mediaVersionId: requireString(input.mediaVersionId, 'placement.mediaVersionId', 200), rightsCaseId: requireString(input.rightsCaseId, 'placement.rightsCaseId', 200), ...(anchorPassageId ? { anchorPassageId } : {}), decorative: input.decorative, ...(!input.decorative ? { alt: safeText(input.alt, 'placement.alt', 1000) } : {}), ...(input.caption ? { caption: safeText(input.caption, 'placement.caption', 4000) } : { captionOmissionReason: safeText(input.captionOmissionReason, 'placement.captionOmissionReason', 1000) }), teachingUse: safeText(input.teachingUse, 'placement.teachingUse', 2000), ...(input.creditOverride ? { creditOverride: safeText(input.creditOverride, 'placement.creditOverride', 1000) } : {}), displayPreset: input.displayPreset, align: input.align, ...(input.animationPolicy ? { animationPolicy: input.animationPolicy } : {}), printPolicy: input.printPolicy, downloadable: input.downloadable };
  if (!existing) assertUniqueBodyIds(chapter, block);
  return { block, existing };
};

export const applySemanticOperation = async (sourceChapter, operation) => {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw new ApiError(400, 'INVALID_OPERATION', 'operation must be an object');
  if (!OPERATION_PAYLOAD_SCHEMAS[operation.type]) throw new ApiError(422, 'OPERATION_NOT_SUPPORTED', 'Unsupported semantic operation', { type: operation.type });
  const schema = OPERATION_PAYLOAD_SCHEMAS[operation.type];
  rejectUnknown(operation, [...schema.required, ...schema.optional]);
  for (const field of schema.required) if (!own(operation, field)) throw new ApiError(400, 'INVALID_OPERATION', `${field} is required`);
  const chapter = structuredClone(sourceChapter);
  chapter.checkpoints = Array.isArray(chapter.checkpoints) ? chapter.checkpoints : [];

  if (operation.type === 'text.replace') {
    const { block } = findUniqueBlock(chapter, operation.blockId);
    if (block.type === 'legacyMarkup') throw new ApiError(422, 'LEGACY_MARKUP_LOCKED', 'legacyMarkup blocks cannot be edited');
    if (!['paragraph', 'heading', 'blockquote', 'callout'].includes(block.type)) throw new ApiError(422, 'BLOCK_NOT_TEXT_EDITABLE', 'Block type does not support text.replace');
    block.text = safeText(operation.text, 'text', block.type === 'heading' ? 1000 : 50000);
  } else if (operation.type === 'chapter.replaceBody') {
    await normalizeChapterBodyReplacement(chapter, operation.body);
  } else if (operation.type === 'block.insert') {
    const index = placementIndex(chapter, operation.position);
    const block = await normalizeInsertedBlock(chapter, operation.block, operation.position);
    chapter.body.splice(index, 0, block);
  } else if (operation.type === 'block.move') {
    const moving = findUniqueBlock(chapter, operation.blockId);
    const anchorId = operation.position?.beforeBlockId || operation.position?.afterBlockId;
    if (anchorId === operation.blockId) throw new ApiError(422, 'POSITION_INVALID', 'A block cannot be positioned relative to itself');
    const block = chapter.body.splice(moving.index, 1)[0];
    const index = placementIndex(chapter, operation.position);
    chapter.body.splice(index, 0, block);
  } else if (operation.type === 'block.remove') {
    const removing = findUniqueBlock(chapter, operation.blockId);
    if (removing.block.type === 'legacyMarkup') throw new ApiError(422, 'LEGACY_MARKUP_LOCKED', 'legacyMarkup blocks cannot be removed');
    if (removing.block.type === 'mediaFigure') throw new ApiError(422, 'MEDIA_REMOVE_REQUIRED', 'Use media.remove so the immutable media asset remains explicit');
    const passageId = removing.block.passageId;
    const dependents = passageId ? [
      ...chapter.checkpoints.filter((item) => item.passageId === passageId).map((item) => ({ kind: 'checkpoint', id: item.checkpointId })),
      ...chapter.body.filter((item) => item.blockId !== operation.blockId && item.anchorPassageId === passageId).map((item) => ({ kind: item.type, id: item.blockId }))
    ] : [];
    if (dependents.length) {
      if (!operation.replacementPassageId) throw new ApiError(409, 'DEPENDENCIES_REQUIRE_REANCHOR', 'Removing this passage requires an explicit replacement passage', { passageId, dependents });
      const replacement = chapter.body.find((item) => item.passageId === operation.replacementPassageId && item.blockId !== operation.blockId);
      if (!replacement || typeof replacement.text !== 'string') throw new ApiError(422, 'REPLACEMENT_PASSAGE_INVALID', 'replacementPassageId must identify another textual passage');
      const excerptHash = await sha256(replacement.text);
      chapter.checkpoints = chapter.checkpoints.map((item) => item.passageId === passageId ? { ...item, passageId: operation.replacementPassageId, passageExcerptHash: excerptHash } : item);
      chapter.body = chapter.body.map((item) => item.anchorPassageId === passageId ? { ...item, anchorPassageId: operation.replacementPassageId } : item);
    }
    chapter.body.splice(chapter.body.findIndex((item) => item.blockId === operation.blockId), 1);
  } else if (operation.type === 'checkpoint.upsert' || operation.type === 'checkpoint.replace') {
    if (!operation.checkpoint || typeof operation.checkpoint !== 'object') throw new ApiError(400, 'INVALID_OPERATION', 'checkpoint payload is required');
    const index = chapter.checkpoints.findIndex((item) => item.slot === operation.checkpoint.slot);
    if (operation.type === 'checkpoint.replace' && index < 0) throw new ApiError(404, 'CHECKPOINT_NOT_FOUND', 'Checkpoint slot does not exist');
    if (index < 0 && chapter.checkpoints.length >= 3) throw new ApiError(422, 'CHECKPOINT_LIMIT', 'A chapter may have at most three checkpoints');
    const normalized = await normalizeCheckpoint(chapter, operation.checkpoint, index >= 0 ? chapter.checkpoints[index] : null);
    if (index >= 0) chapter.checkpoints[index] = normalized; else chapter.checkpoints.push(normalized);
    chapter.checkpoints.sort((a, b) => CHECKPOINT_SLOTS.indexOf(a.slot) - CHECKPOINT_SLOTS.indexOf(b.slot));
  } else if (operation.type === 'checkpoint.remove') {
    if (!CHECKPOINT_SLOTS.includes(operation.slot)) throw new ApiError(422, 'CHECKPOINT_SLOT_INVALID', 'Checkpoint slot must be commit, work, or reconcile');
    const index = chapter.checkpoints.findIndex((item) => item.slot === operation.slot);
    if (index < 0) throw new ApiError(404, 'CHECKPOINT_NOT_FOUND', 'Checkpoint slot does not exist');
    if (operation.checkpointId !== undefined && operation.checkpointId !== chapter.checkpoints[index].checkpointId) throw new ApiError(409, 'CHECKPOINT_ID_CONFLICT', 'Checkpoint ID does not match the selected slot');
    chapter.checkpoints.splice(index, 1);
  } else if (operation.type === 'embed.upsert') {
    const normalized = await normalizeEmbed(chapter, operation.embed);
    if (normalized.existing) chapter.body[chapter.body.indexOf(normalized.existing)] = normalized.block;
    else chapter.body.splice(placementIndex(chapter, operation.position), 0, normalized.block);
  } else if (operation.type === 'media.place') {
    const normalized = await normalizeMediaPlacement(chapter, operation.placement);
    if (normalized.existing) chapter.body[chapter.body.indexOf(normalized.existing)] = normalized.block;
    else chapter.body.splice(placementIndex(chapter, operation.position), 0, normalized.block);
  } else if (operation.type === 'media.remove') {
    const figureId = requireString(operation.figureId, 'figureId', 200);
    const index = chapter.body.findIndex((item) => item.type === 'mediaFigure' && item.figureId === figureId);
    if (index < 0) throw new ApiError(404, 'MEDIA_PLACEMENT_NOT_FOUND', 'Media placement does not exist');
    chapter.body.splice(index, 1);
  }
  return { chapter, contentHash: await sha256(chapter) };
};

export const validateChapter = (chapter, { publishable = false } = {}) => {
  const errors = [];
  const checkpoints = Array.isArray(chapter.checkpoints) ? chapter.checkpoints : [];
  if (checkpoints.length > 3) errors.push({ code: 'CHECKPOINT_LIMIT', path: 'checkpoints' });
  const slots = checkpoints.map((item) => item.slot);
  if (new Set(slots).size !== slots.length) errors.push({ code: 'CHECKPOINT_SLOT_DUPLICATE', path: 'checkpoints' });
  if (publishable && stableStringify(slots) !== stableStringify(CHECKPOINT_SLOTS)) errors.push({ code: 'CHECKPOINT_SEQUENCE_REQUIRED', path: 'checkpoints' });
  const anchors = passageIds(chapter);
  checkpoints.forEach((item, index) => {
    if (!anchors.has(item.passageId)) errors.push({ code: 'CHECKPOINT_ANCHOR_MISSING', path: `checkpoints.${index}.passageId` });
    if (!/^[a-f0-9]{64}$/.test(item.passageExcerptHash || '')) errors.push({ code: 'CHECKPOINT_EXCERPT_HASH_INVALID', path: `checkpoints.${index}.passageExcerptHash` });
    if (typeof item.showInSidebar !== 'boolean') errors.push({ code: 'CHECKPOINT_SIDEBAR_INVALID', path: `checkpoints.${index}.showInSidebar` });
    if (!['prose', 'movement-plus-prose'].includes(item.responseStructure)) errors.push({ code: 'CHECKPOINT_RESPONSE_STRUCTURE_INVALID', path: `checkpoints.${index}.responseStructure` });
    if (!Number.isInteger(item.minWords) || !Number.isInteger(item.maxWords) || item.minWords < 1 || item.maxWords > 1000 || item.minWords > item.maxWords) errors.push({ code: 'CHECKPOINT_RESPONSE_RANGE_INVALID', path: `checkpoints.${index}` });
  });
  const ids = new Map();
  bodyBlocks(chapter).forEach((block, index) => {
    for (const field of ['blockId', 'passageId', 'sectionId', 'figureId', 'embedId', 'linkId']) {
      if (!block?.[field]) continue;
      const key = `${field}:${block[field]}`;
      if (ids.has(key)) errors.push({ code: 'STABLE_ID_DUPLICATE', path: `body.${index}.${field}` }); else ids.set(key, index);
    }
    if (block?.type === 'legacyMarkup') return;
    if (block?.type === 'externalEmbed' && (!block.fallback || !block.canonicalUrl?.startsWith('https://'))) errors.push({ code: 'EMBED_FALLBACK_INVALID', path: `body.${index}` });
    if (block?.type === 'mediaFigure') {
      if (!block.mediaId || !block.mediaVersionId || !block.rightsCaseId) errors.push({ code: 'MEDIA_PLACEMENT_INVALID', path: `body.${index}` });
      if (typeof block.decorative !== 'boolean' || (!block.decorative && !block.alt)) errors.push({ code: 'MEDIA_ALT_REQUIRED', path: `body.${index}.alt` });
      if (Boolean(block.caption) === Boolean(block.captionOmissionReason)) errors.push({ code: 'MEDIA_CAPTION_INVALID', path: `body.${index}` });
      if (!block.teachingUse || !['narrow', 'reading', 'wide', 'bleed'].includes(block.displayPreset) || !['start', 'center', 'end'].includes(block.align) || !['poster', 'firstFrame', 'omit'].includes(block.printPolicy) || (block.animationPolicy !== undefined && !['clickToPlay', 'playOnce', 'loopWithControls'].includes(block.animationPolicy))) errors.push({ code: 'MEDIA_PRESENTATION_INVALID', path: `body.${index}` });
    }
  });
  return { valid: errors.length === 0, errors };
};

export const assertCas = ({ expectedVersion, actualVersion, expectedRevisionId, actualRevisionId }) => {
  if (expectedVersion !== undefined && expectedVersion !== actualVersion) {
    throw new ConflictError('stale_working_document', { version: actualVersion });
  }
  if (expectedRevisionId !== undefined && expectedRevisionId !== actualRevisionId) {
    throw new ConflictError('stale_base_revision', { revision_id: actualRevisionId });
  }
};

export const checkpointDraft = async (working, { content, actorId, expectedVersion }) => {
  assertCas({ expectedVersion, actualVersion: working.version });
  const contentHash = await sha256(content);
  return {
    ...working,
    content,
    content_hash: contentHash,
    checkpoint: working.checkpoint + 1,
    version: working.version + 1,
    updated_by: actorId
  };
};

const diffFields = (before, after, ignored = new Set()) => [...new Set([
  ...Object.keys(before || {}), ...Object.keys(after || {})
])].filter((key) => !ignored.has(key) && stableStringify(before?.[key]) !== stableStringify(after?.[key])).sort();

const stableIdentity = (item, fallback) => item?.blockId || item?.checkpointId || item?.figureId || item?.embedId || item?.linkId || fallback;

const longestCommonSubsequence = (left, right) => {
  const table = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) for (let j = right.length - 1; j >= 0; j -= 1) {
    table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const result = [];
  for (let i = 0, j = 0; i < left.length && j < right.length;) {
    if (left[i] === right[j]) { result.push(left[i]); i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return new Set(result);
};

/**
 * Produces a deterministic, content-free semantic summary suitable for review UIs.
 * Stable identifiers are reported, but authored prose and media URLs are not copied
 * into the diff response.
 */
export const semanticDiffChapter = (baseChapter, workingChapter) => {
  const baseBlocks = Array.isArray(baseChapter?.body) ? baseChapter.body : [];
  const workingBlocks = Array.isArray(workingChapter?.body) ? workingChapter.body : [];
  const baseById = new Map(baseBlocks.map((item, index) => [stableIdentity(item, `base-index-${index}`), { item, index }]));
  const workingById = new Map(workingBlocks.map((item, index) => [stableIdentity(item, `working-index-${index}`), { item, index }]));
  const blockIds = [...new Set([...baseById.keys(), ...workingById.keys()])].sort();
  const commonIds = new Set(blockIds.filter((id) => baseById.has(id) && workingById.has(id)));
  const unchangedOrder = longestCommonSubsequence(
    [...baseById.keys()].filter((id) => commonIds.has(id)),
    [...workingById.keys()].filter((id) => commonIds.has(id))
  );
  const blocks = { added: [], removed: [], modified: [], moved: [] };
  for (const id of blockIds) {
    const before = baseById.get(id);
    const after = workingById.get(id);
    if (!before) blocks.added.push({ blockId: id, type: after.item?.type || null, afterIndex: after.index });
    else if (!after) blocks.removed.push({ blockId: id, type: before.item?.type || null, beforeIndex: before.index });
    else {
      const changedFields = diffFields(before.item, after.item, new Set(['blockId']));
      if (changedFields.length) blocks.modified.push({ blockId: id, beforeType: before.item?.type || null, afterType: after.item?.type || null, changedFields });
      if (!unchangedOrder.has(id)) blocks.moved.push({ blockId: id, type: after.item?.type || null, beforeIndex: before.index, afterIndex: after.index });
    }
  }

  const checkpointKey = (item, index) => item?.checkpointId || (item?.slot ? `slot:${item.slot}` : `index:${index}`);
  const baseCheckpoints = Array.isArray(baseChapter?.checkpoints) ? baseChapter.checkpoints : [];
  const workingCheckpoints = Array.isArray(workingChapter?.checkpoints) ? workingChapter.checkpoints : [];
  const baseCheckpointMap = new Map(baseCheckpoints.map((item, index) => [checkpointKey(item, index), item]));
  const workingCheckpointMap = new Map(workingCheckpoints.map((item, index) => [checkpointKey(item, index), item]));
  const checkpointIds = [...new Set([...baseCheckpointMap.keys(), ...workingCheckpointMap.keys()])].sort();
  const checkpoints = { added: [], removed: [], modified: [], anchorsChanged: [] };
  for (const id of checkpointIds) {
    const before = baseCheckpointMap.get(id);
    const after = workingCheckpointMap.get(id);
    const summary = (item) => ({ checkpointId: item?.checkpointId || null, slot: item?.slot || null });
    if (!before) checkpoints.added.push(summary(after));
    else if (!after) checkpoints.removed.push(summary(before));
    else {
      const changedFields = diffFields(before, after, new Set(['checkpointId']));
      if (changedFields.length) checkpoints.modified.push({ ...summary(after), changedFields });
      if (before.passageId !== after.passageId || before.passageExcerptHash !== after.passageExcerptHash) checkpoints.anchorsChanged.push({
        ...summary(after), beforePassageId: before.passageId || null, afterPassageId: after.passageId || null,
        excerptHashChanged: before.passageExcerptHash !== after.passageExcerptHash
      });
    }
  }

  const metadataChangedFields = diffFields(baseChapter, workingChapter, new Set(['body', 'checkpoints']));
  const changedBlockKinds = [...new Set([
    ...blocks.added.map((item) => item.type), ...blocks.removed.map((item) => item.type),
    ...blocks.modified.flatMap((item) => [item.beforeType, item.afterType]), ...blocks.moved.map((item) => item.type)
  ].filter(Boolean))].sort();
  const stableIds = {
    added: blocks.added.map((item) => item.blockId).sort(),
    removed: blocks.removed.map((item) => item.blockId).sort()
  };
  const summary = {
    changed: metadataChangedFields.length > 0 || Object.values(blocks).some((items) => items.length > 0) || Object.values(checkpoints).some((items) => items.length > 0),
    metadataFieldsChanged: metadataChangedFields.length,
    blocksAdded: blocks.added.length,
    blocksRemoved: blocks.removed.length,
    blocksModified: blocks.modified.length,
    blocksMoved: blocks.moved.length,
    checkpointsAdded: checkpoints.added.length,
    checkpointsRemoved: checkpoints.removed.length,
    checkpointsModified: checkpoints.modified.length,
    checkpointAnchorsChanged: checkpoints.anchorsChanged.length,
    embedsAffected: changedBlockKinds.filter((kind) => kind === 'externalEmbed' || kind === 'richLink').length > 0,
    mediaAffected: changedBlockKinds.includes('mediaFigure'),
    derivativesAffected: blocks.modified.some((item) => (item.beforeType === 'mediaFigure' || item.afterType === 'mediaFigure') && item.changedFields.some((field) => ['mediaId', 'mediaVersionId', 'printPolicy', 'animationPolicy'].includes(field)))
  };
  return { summary, metadata: { changedFields: metadataChangedFields }, blocks, checkpoints, impact: { stableIds, changedBlockKinds } };
};

/** Returns an existing response only when the key represents exactly the same request. */
export const resolveIdempotency = async ({ existing, scope, key, request }) => {
  const requestHash = await sha256(request);
  if (!existing) return { kind: 'new', scope, key, requestHash };
  if (existing.request_hash !== requestHash) throw new ConflictError('idempotency_key_reused', {});
  return { kind: 'replay', response_status: existing.response_status, response_json: existing.response_json };
};
