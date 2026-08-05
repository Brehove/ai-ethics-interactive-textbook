import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

const instructions = 'Read the authoring view and the current passage before editing. Create or resume an isolated changeset, use typed semantic operations, preview, and inspect history. Commit live only when the user explicitly asks to save or publish and the capability explicitly allows commit_live for that exact chapter. Never send raw HTML, CSS, SQL, or database patches.';
const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true };
const mutates = { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true };
const commitsLive = { readOnlyHint: false, destructiveHint: true, openWorldHint: true, idempotentHint: true };
const position = z.union([z.object({ beforePassageId: id }).strict(), z.object({ afterPassageId: id }).strict()]);
const write = { changeSetId: id, documentId: id, baseRevisionId: id, expectedVersion: z.number().int().positive(), idempotencyKey: uuid };
const checkpoint = z.object({
  checkpointId: id.optional(), legacyId: z.string().min(1).max(200).optional(), passageId: id,
  displayOrder: z.number().int().min(0), stage: z.string().min(1).max(120).optional(), slotLabel: z.string().min(1).max(120).optional(),
  strategy: z.enum(['initial-judgment', 'self-explanation', 'argument-reconstruction', 'evidence-warrant', 'contrast-case', 'counterexample', 'consider-alternative', 'objection-repair', 'question-generation', 'epistemic-calibration', 'framework-comparison', 'transfer', 'metacognitive-trace']),
  title: z.string().min(1).max(200), trigger: z.string().min(1).max(300), prompt: z.string().min(1).max(4000), guidance: z.string().min(1).max(2000),
  responseStructure: z.enum(['prose', 'movement-plus-prose']), minWords: z.number().int().min(1).max(1000), maxWords: z.number().int().min(1).max(1000), rationale: z.string().min(1).max(2000), showInSidebar: z.boolean()
}).strict().refine((value) => value.minWords <= value.maxWords, 'minWords must not exceed maxWords');
const mediaPlacement = z.object({ mediaId: id, mediaVersionId: id, rightsCaseId: id, placementId: id.optional(), anchorPassageId: id, decorative: z.boolean(), alt: z.string().max(2000).optional(), caption: z.string().max(4000).optional(), captionOmissionReason: z.string().max(1000).optional(), teachingUse: z.string().min(1).max(2000), creditOverride: z.string().max(1000).optional(), displayPreset: z.enum(['narrow', 'reading', 'wide', 'bleed']), align: z.enum(['start', 'center', 'end']), animationPolicy: z.enum(['clickToPlay', 'playOnce', 'loopWithControls']).optional(), printPolicy: z.enum(['poster', 'firstFrame', 'omit']), downloadable: z.boolean() }).strict().refine((value) => value.decorative || Boolean(value.alt), 'Nondecorative media requires alt text').refine((value) => Boolean(value.caption || value.captionOmissionReason), 'Caption or omission reason is required');
const provider = z.enum(['youtube', 'vimeo', 'x', 'spotify', 'soundcloud', 'bluesky']);
const fallback = z.object({ title: z.string().min(1).max(300), summary: z.string().min(1).max(4000), linkLabel: z.string().min(1).max(120), accessedAt: z.string().datetime() }).strict();
const embed = z.object({ embedId: id.optional(), anchorPassageId: id, provider, canonicalUrl: z.string().url().startsWith('https://'), caption: z.string().min(1).max(2000), teachingUse: z.string().min(1).max(2000), displayPreset: z.enum(['compact', 'reading', 'wide']), fallback }).strict();
const personFeatureProjection = z.object({
  personFeatureId: id.optional(), placementId: id, personId: id, entityRevisionId: id, name: z.string().min(1).max(300), dates: z.string().min(1).max(120), role: z.string().min(1).max(300), teachingNote: z.string().min(1).max(2000), biography: z.string().min(1).max(10000),
  primarySources: z.array(z.object({ sourceId: z.string().min(1).max(200), title: z.string().min(1).max(500), creator: z.string().min(1).max(300), locator: z.string().max(500).optional(), translation: z.string().max(500).optional(), excerpt: z.string().max(5000).optional(), teachingUse: z.string().min(1).max(2000), label: z.string().min(1).max(300), url: z.string().url().startsWith('https://').optional() }).strict()),
  portrait: z.object({ mediaVersionId: id, src: z.string().min(1).max(2000), width: z.number().int().positive(), height: z.number().int().positive(), alt: z.string().min(1).max(2000), credit: z.string().min(1).max(2000), title: z.string().min(1).max(500), creator: z.string().max(300).optional(), derivativeModification: z.string().max(1000).optional(), license: z.string().min(1).max(500), licenseUrl: z.string().url().optional(), sourceUrl: z.string().url().startsWith('https://').optional(), commonsPageUrl: z.string().url().startsWith('https://').optional(), reviewedSourceRevision: z.string().min(1).max(300).optional() }).strict()
}).strict();
const managedPlacement = z.object({ placementId: id, kind: z.enum(['personFeature', 'media', 'embed', 'diagram', 'artifact']), contentId: id, anchorPassageId: id, position: z.enum(['before', 'after']), orderAtAnchor: z.number().int().min(0), displayPreset: z.enum(['thinker-card', 'narrow', 'reading', 'wide', 'bleed', 'compact']) }).strict();
const uploadRequest = z.object({ reviewPackageId: id, filename: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/), mimeType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 'video/webm', 'application/pdf', 'text/plain']), bytes: z.number().int().min(1).max(25 * 1024 * 1024), sha256: hash, idempotencyKey: uuid, transcriptEquivalent: z.object({ provided: z.literal(true), language: z.string().min(1).max(40), text: z.string().min(1).max(50000) }).strict().optional(), poster: z.object({ provided: z.literal(true), alt: z.string().min(1).max(2000) }).strict().optional() }).strict();
const mediaReviewPackage = z.object({
  rights: z.object({ basis: z.enum(['owned', 'licensed', 'permission', 'publicDomain', 'fairUse', 'unknown']), creator: z.string().min(1).max(300), sourceUrl: z.string().url().startsWith('https://').optional(), license: z.string().min(1).max(300).optional(), attribution: z.string().min(1).max(1000), permissionEvidenceRef: z.string().min(1).max(300).optional(), notes: z.string().min(1).max(2000).optional() }).strict(),
  editorial: z.object({ teachingUse: z.string().min(1).max(2000), placementIntent: z.string().min(1).max(1000), notes: z.string().min(1).max(2000).optional() }).strict(),
  accessibility: z.object({ decorative: z.boolean(), altText: z.string().min(1).max(1000).optional(), transcriptEquivalent: z.object({ language: z.string().min(1).max(40), text: z.string().min(1).max(50000) }).strict().optional(), motionReview: z.enum(['notApplicable', 'pending', 'passed', 'failed']).optional(), notes: z.string().min(1).max(2000).optional() }).strict().refine((value) => value.decorative || Boolean(value.altText), 'Nondecorative media requires alt text'),
  idempotencyKey: uuid
}).strict();
const asResult = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data });
const MCP_ORIGIN = 'https://mcp.ethicsandai.your-digital-life.org';
const MCP_RESOURCE = `${MCP_ORIGIN}/mcp`;
const MCP_RESOURCE_METADATA = `${MCP_ORIGIN}/.well-known/oauth-protected-resource`;
const AUTHORIZATION_SERVER = 'https://auth.ethicsandai.your-digital-life.org';

const operationScopes = Object.freeze({
  get_authoring_view: ['content:read'], get_passage: ['content:read'], get_version_history: ['content:read'], get_live_commit_status: ['content:read'], get_person: ['content:read'], search_persons: ['content:read'], search_media: ['media:read'], get_media_job: ['media:read'], get_media_asset: ['media:read'],
  create_or_resume_changeset: ['content:write'], replace_passage_text: ['content:write'], replace_chapter_document: ['content:write'], upsert_checkpoint: ['content:write'], remove_checkpoint: ['content:write'], reorder_checkpoint: ['content:write'], place_media: ['content:write'], upsert_embed: ['content:write'], resolve_provider_url: ['content:write'], upsert_person_feature: ['content:write'], move_managed_placement: ['content:write'], remove_managed_placement: ['content:write'], preview_changes: ['content:write'], restore_revision_as_draft: ['content:write'], create_media_review_package: ['media:upload'], upload_media: ['media:upload'],
  request_live_save_authorization: ['content:write'], commit_live: ['content:live-save']
});

function normaliseCapability(value) {
  if (!value || typeof value !== 'object') throw new Error('Capability verifier returned no claims');
  const claims = value;
  if (claims.actorType !== 'agent' || typeof claims.actorId !== 'string' || typeof claims.clientId !== 'string' || typeof claims.runId !== 'string' || typeof claims.jti !== 'string') throw new Error('Capability identity is invalid');
  if (!Array.isArray(claims.scopes) || !Array.isArray(claims.allowedDocumentIds) || !Array.isArray(claims.allowedOperations)) throw new Error('Capability allowlists are invalid');
  if (claims.scopes.some((scope) => typeof scope !== 'string') || claims.allowedDocumentIds.some((documentId) => typeof documentId !== 'string') || claims.allowedOperations.some((operation) => typeof operation !== 'string')) throw new Error('Capability allowlists are invalid');
  return { actorId: claims.actorId, actorType: 'agent', clientId: claims.clientId, runId: claims.runId, jti: claims.jti, scopes: [...new Set(claims.scopes)], allowedDocumentIds: [...new Set(claims.allowedDocumentIds)], allowedOperations: [...new Set(claims.allowedOperations)], expiresAt: typeof claims.expiresAt === 'string' ? claims.expiresAt : null };
}

export async function verifyCapability(env, bearerToken, target = {}) {
  if (!bearerToken || !env.AUTH_CAPABILITY || typeof env.AUTH_CAPABILITY.verifyCapability !== 'function') throw new Error('Capability verification is unavailable');
  return normaliseCapability(await env.AUTH_CAPABILITY.verifyCapability(bearerToken, target));
}

function authorise(identity, operation, documentId) {
  const scopes = operationScopes[operation];
  if (!scopes || !scopes.every((scope) => identity.scopes.includes(scope))) throw new Error(`Capability does not grant ${operation}`);
  if (documentId && !identity.allowedDocumentIds.includes(documentId)) throw new Error(`Capability does not grant document ${documentId}`);
  if (!identity.allowedOperations.includes(operation)) throw new Error(`Capability does not grant operation ${operation}`);
}

function createApi(env, requestId, context) {
  return async (path, { method = 'GET', body, operation, documentId, mutation = false } = {}) => {
    // Recheck every call. This is stricter than the 15-second maximum read cache
    // permitted by the capability policy and makes revocation take effect before
    // any MCP operation reaches the content service.
    const identity = await verifyCapability(env, context.bearerToken, { documentId, operation });
    authorise(identity, operation, documentId);
    const response = await env.CONTENT_API.fetch(new Request(`https://content-api.internal${path}`, { method, headers: { accept: 'application/json', authorization: `Bearer ${context.bearerToken}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    const data = await response.json().catch(() => ({ error: { code: 'INVALID_UPSTREAM_RESPONSE', message: 'Content API returned non-JSON' } }));
    if (!response.ok) throw new Error(`${response.status} ${data.error?.code ?? 'CONTENT_API_ERROR'}: ${data.error?.message ?? 'Request failed'}`);
    return data;
  };
}

function operationTool(server, call, name, title, description, operationSchema, annotations = mutates) {
  server.registerTool(name, { title, description, inputSchema: { ...write, operation: operationSchema }, annotations }, async ({ changeSetId, documentId, baseRevisionId, expectedVersion, idempotencyKey, operation }) => asResult(await call(`/v1/changesets/${encodeURIComponent(changeSetId)}/operations:batch`, { method: 'POST', operation: name, documentId, mutation: true, body: { documentId, baseRevisionId, expectedVersion, idempotencyKey, operations: [operation] } })));
}

export function createMcp(env, requestId, context) {
  if (!context?.identity || !context?.bearerToken) throw new Error('An authenticated capability context is required');
  const call = createApi(env, requestId, context);
  const server = new McpServer({ name: 'ai-ethics-textbook', version: '1.0.0' }, { instructions });
  server.registerTool('get_authoring_view', { title: 'Get authoring view', description: 'Read the complete canonical chapter document, stable passages, checkpoints, placements, and frozen renderer projection.', inputSchema: { chapterId: id }, annotations: readOnly }, async ({ chapterId }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/authoring-view`, { operation: 'get_authoring_view', documentId: chapterId })));
  server.registerTool('get_passage', { title: 'Get passage', description: 'Read one exact stable passage before an anchored edit.', inputSchema: { chapterId: id, passageId: id }, annotations: readOnly }, async ({ chapterId, passageId }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/passages/${encodeURIComponent(passageId)}`, { operation: 'get_passage', documentId: chapterId })));
  server.registerTool('search_media', { title: 'Search cleared or pending media', description: 'Find reusable media by bounded text, kind, rights state, or exact source hash before uploading a duplicate.', inputSchema: { query: z.string().max(100).optional(), kind: z.enum(['image', 'audio', 'video', 'document']).optional(), rightsStatus: z.enum(['reviewRequired', 'cleared', 'blocked']).optional(), sha256: hash.optional(), limit: z.number().int().min(1).max(50).optional(), cursor: z.number().int().min(0).max(10000).optional() }, annotations: readOnly }, async ({ query, kind, rightsStatus, sha256, limit = 20, cursor = 0 }) => {
    const params = new URLSearchParams({ limit: String(limit), cursor: String(cursor) });
    if (query) params.set('q', query); if (kind) params.set('kind', kind); if (rightsStatus) params.set('rightsStatus', rightsStatus); if (sha256) params.set('sha256', sha256);
    return asResult(await call(`/v1/media?${params}`, { operation: 'search_media' }));
  });
  server.registerTool('create_media_review_package', { title: 'Create media review package', description: 'Persist exact rights, teaching-use, and accessibility declarations. The result is pending evidence and never implicit clearance.', inputSchema: mediaReviewPackage, annotations: mutates }, async (body) => asResult(await call('/v1/media-review-packages', { method: 'POST', operation: 'create_media_review_package', mutation: true, body })));
  server.registerTool('get_media_job', { title: 'Get media processing job', description: 'Poll one exact upload/processing job without assuming it completed or cleared rights.', inputSchema: { jobId: id }, annotations: readOnly }, async ({ jobId }) => asResult(await call(`/v1/media/jobs/${encodeURIComponent(jobId)}`, { operation: 'get_media_job' })));
  server.registerTool('get_media_asset', { title: 'Get media asset', description: 'Read the exact processed asset, immutable versions, and rights state before placement.', inputSchema: { mediaId: id }, annotations: readOnly }, async ({ mediaId }) => asResult(await call(`/v1/media/${encodeURIComponent(mediaId)}`, { operation: 'get_media_asset' })));
  server.registerTool('create_or_resume_changeset', { title: 'Create or resume changeset', description: 'Open or resume one isolated chapter draft.', inputSchema: { chapterId: id, title: z.string().min(1).max(200), description: z.string().max(2000).optional(), resume: z.boolean().optional(), idempotencyKey: uuid }, annotations: mutates }, async ({ chapterId, title, description, resume, idempotencyKey }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/changesets`, { method: 'POST', operation: 'create_or_resume_changeset', documentId: chapterId, mutation: true, body: { title, ...(description ? { description } : {}), ...(resume ? { resume: true } : {}), idempotencyKey } })));
  operationTool(server, call, 'replace_passage_text', 'Replace passage text', 'Replace prose in one stable passage without raw markup. Read the passage first and use its exact blockId.', z.object({ type: z.literal('text.replace'), blockId: id, text: z.string().min(1).max(50000) }).strict());
  operationTool(server, call, 'replace_chapter_document', 'Replace chapter document', 'Replace the editable chapter document while preserving managed placements unless separately removed.', z.object({ type: z.literal('chapter.replaceDocument'), document: z.record(z.unknown()) }).strict(), { ...mutates, destructiveHint: true });
  operationTool(server, call, 'upsert_checkpoint', 'Upsert checkpoint', 'Create or revise a checkpoint. Any number may share a passage or stage; displayOrder controls ordering.', z.object({ type: z.literal('checkpoint.upsert'), checkpoint }).strict());
  operationTool(server, call, 'remove_checkpoint', 'Remove checkpoint', 'Remove one checkpoint by its stable checkpoint ID.', z.object({ type: z.literal('checkpoint.remove'), checkpointId: id }).strict(), { ...mutates, destructiveHint: true });
  operationTool(server, call, 'reorder_checkpoint', 'Reorder checkpoint', 'Replace one known checkpoint with the same content and an explicit displayOrder. This uses the same server-owned checkpoint.upsert operation as create and revise.', z.object({ type: z.literal('checkpoint.upsert'), checkpoint }).strict());
  operationTool(server, call, 'place_media', 'Place media', 'Place one immutable, cleared media version at a stable passage.', z.object({ type: z.literal('media.place'), placement: mediaPlacement }).strict());
  operationTool(server, call, 'upsert_embed', 'Upsert embed', 'Place an allowlisted provider embed with an authored fallback; raw iframe markup is not accepted.', z.object({ type: z.literal('embed.upsert'), embed }).strict());
  server.registerTool('resolve_provider_url', { title: 'Resolve provider URL', description: 'Resolve a YouTube, Vimeo, X, Spotify, SoundCloud, Bluesky, or authored HTTPS rich-link proposal without fetching arbitrary provider HTML.', inputSchema: { url: z.string().url().startsWith('https://'), expectedProvider: provider.optional() }, annotations: mutates }, async (body) => asResult(await call('/v1/embeds:resolve', { method: 'POST', operation: 'resolve_provider_url', mutation: true, body })));
  operationTool(server, call, 'upsert_person_feature', 'Upsert person feature', 'Place a frozen curated-person feature and its explicit managed placement; raw biography HTML is never accepted.', z.object({ type: z.literal('personFeature.upsert'), feature: personFeatureProjection, placement: managedPlacement }).strict());
  operationTool(server, call, 'move_managed_placement', 'Move managed placement', 'Move a typed media, embed, or person feature without serializing it into prose.', z.object({ type: z.literal('managedPlacement.move'), placementId: id, anchorPassageId: id, position: z.enum(['before', 'after']), orderAtAnchor: z.number().int().min(0), displayPreset: z.enum(['thinker-card', 'narrow', 'reading', 'wide', 'bleed', 'compact']).optional() }).strict());
  operationTool(server, call, 'remove_managed_placement', 'Remove managed placement', 'Remove one managed media, embed, or person feature placement.', z.object({ type: z.literal('managedPlacement.remove'), placementId: id }).strict(), { ...mutates, destructiveHint: true });
  server.registerTool('upload_media', { title: 'Request media upload', description: 'Request a short-lived, hash- and size-bound, single-use raw-binary upload ticket. Use its public upload URL and one-time token with the bundled local helper; no standing OAuth bearer is exported.', inputSchema: uploadRequest, annotations: mutates }, async (body) => {
    const ticket = await call('/v1/media:requestUpload', { method: 'POST', operation: 'upload_media', mutation: true, body });
    return asResult({ ...ticket, upload: { ...ticket.upload, url: `${MCP_RESOURCE}/media-upload/${encodeURIComponent(ticket.ticketId)}` } });
  });
  server.registerTool('preview_changes', { title: 'Preview changes', description: 'Create a one-time, read-only snapshot preview of the chapter draft.', inputSchema: { ...write, surface: z.enum(['web', 'mobile', 'print', 'offline']).optional() }, annotations: mutates }, async ({ changeSetId, documentId, baseRevisionId, expectedVersion, idempotencyKey, surface }) => asResult(await call(`/v1/changesets/${encodeURIComponent(changeSetId)}:renderPreview`, { method: 'POST', operation: 'preview_changes', documentId, mutation: true, body: { documentId, baseRevisionId, expectedVersion, idempotencyKey, ...(surface ? { surface } : {}) } })));
  server.registerTool('request_live_save_authorization', { title: 'Request Live Save authorization', description: 'Create a short-lived instructor approval request bound to this exact chapter, changeset, base revision, expected version, and idempotency key. It does not publish.', inputSchema: write, annotations: mutates }, async (target) => {
    if (typeof env.AUTH_CAPABILITY?.requestLiveSaveAuthorization !== 'function') throw new Error('Live Save authorization is unavailable');
    return asResult(await env.AUTH_CAPABILITY.requestLiveSaveAuthorization(context.bearerToken, target));
  });
  server.registerTool('commit_live', { title: 'Save and publish chapter', description: 'After the instructor approves request_live_save_authorization, validate, version, project, and publish that exact D1-authoritative chapter revision.', inputSchema: { liveSaveRequestId: id, ...write, operations: z.array(z.record(z.unknown())).max(100).optional() }, annotations: commitsLive }, async ({ liveSaveRequestId, changeSetId, documentId, baseRevisionId, expectedVersion, idempotencyKey, operations }) => {
    if (typeof env.AUTH_CAPABILITY?.consumeLiveSaveAuthorization !== 'function') throw new Error('Live Save authorization is unavailable');
    const target = { changeSetId, documentId, baseRevisionId, expectedVersion, idempotencyKey };
    const authorization = await env.AUTH_CAPABILITY.consumeLiveSaveAuthorization(context.bearerToken, liveSaveRequestId, target);
    if (authorization?.pending === true) return asResult({ state: 'authorization_pending', requestId: liveSaveRequestId });
    if (typeof authorization?.accessToken !== 'string') throw new Error('Live Save authorization did not issue a capability');
    const liveIdentity = await verifyCapability(env, authorization.accessToken, { documentId, operation: 'commit_live', scope: 'content:live-save' });
    const liveCall = createApi(env, requestId, { bearerToken: authorization.accessToken, identity: liveIdentity });
    return asResult(await liveCall(`/v1/changesets/${encodeURIComponent(changeSetId)}:commitLive`, { method: 'POST', operation: 'commit_live', documentId, mutation: true, body: { documentId, baseRevisionId, expectedVersion, idempotencyKey, operations: operations ?? [] } }));
  });
  server.registerTool('get_live_commit_status', { title: 'Get live commit status', description: 'Recheck the public delivery identity for a prior live commit. A pending receipt does not create another revision.', inputSchema: { chapterId: id, commitReceiptId: id }, annotations: readOnly }, async ({ chapterId, commitReceiptId }) => asResult(await call(`/v1/live-commits/${encodeURIComponent(commitReceiptId)}`, { operation: 'get_live_commit_status', documentId: chapterId })));
  server.registerTool('get_version_history', { title: 'Get version history', description: 'Read paginated immutable revision history and provenance.', inputSchema: { chapterId: id, limit: z.number().int().min(1).max(100).optional(), cursor: z.number().int().min(0).max(10000).optional() }, annotations: readOnly }, async ({ chapterId, limit = 20, cursor = 0 }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/revisions?limit=${limit}&cursor=${cursor}`, { operation: 'get_version_history', documentId: chapterId })));
  server.registerTool('restore_revision_as_draft', { title: 'Restore revision as draft', description: 'Seed a new isolated draft from immutable history; it never overwrites the current chapter.', inputSchema: { chapterId: id, revisionId: id, title: z.string().min(1).max(200), idempotencyKey: uuid }, annotations: mutates }, async ({ chapterId, revisionId, title, idempotencyKey }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/revisions/${encodeURIComponent(revisionId)}:restoreAsDraft`, { method: 'POST', operation: 'restore_revision_as_draft', documentId: chapterId, mutation: true, body: { title, idempotencyKey } })));
  server.registerTool('search_persons', { title: 'Search curated people', description: 'Find curated person records for a typed person-feature placement.', inputSchema: { query: z.string().min(1).max(200), limit: z.number().int().min(1).max(50).optional() }, annotations: readOnly }, async ({ query, limit = 20 }) => asResult(await call(`/v1/persons?q=${encodeURIComponent(query)}&limit=${limit}`, { operation: 'search_persons' })));
  server.registerTool('get_person', { title: 'Get curated person', description: 'Read a person and its current immutable projection before feature placement.', inputSchema: { personId: id }, annotations: readOnly }, async ({ personId }) => asResult(await call(`/v1/persons/${encodeURIComponent(personId)}`, { operation: 'get_person' })));
  for (const [name, tool] of Object.entries(server._registeredTools)) {
    // `commit_live` stays visible to an ordinary OAuth connection, but its
    // handler can only run after the exact, separately-approved step-up above.
    if (name === 'commit_live') continue;
    if (!operationScopes[name] || !operationScopes[name].every((scope) => context.identity.scopes.includes(scope)) || !context.identity.allowedOperations.includes(name)) tool.disable();
  }
  server.registerResource('Agent capability receipt', 'textbook://capabilities', { title: 'Agent capability receipt', description: 'Authenticated capability and its enforced boundaries.', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ actorId: context.identity.actorId, clientId: context.identity.clientId, runId: context.identity.runId, jti: context.identity.jti, scopes: context.identity.scopes, allowedDocumentIds: context.identity.allowedDocumentIds, allowedOperations: context.identity.allowedOperations, mayCommitLive: context.identity.scopes.includes('content:live-save') && context.identity.allowedOperations.includes('commit_live'), liveSaveRequiresExactInstructorConfirmation: true, cannot: ['approve rights', 'change authority', 'deploy code or schema', 'hard-delete history', 'write D1 or R2 directly'] }) }] }));
  return server;
}

const directJson = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
const directError = (status, code, message) => directJson({ error: { code, message } }, status);

export async function handleDirectMediaUpload(request, env, context) {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/media-upload/request') {
      if (request.method !== 'POST') return directError(405, 'METHOD_NOT_ALLOWED', 'Use POST');
      const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > 32768) return directError(413, 'BODY_TOO_LARGE', 'Upload request metadata is too large');
      const parsed = uploadRequest.safeParse(JSON.parse(raw)); if (!parsed.success) return directError(422, 'UPLOAD_REQUEST_INVALID', parsed.error.issues[0]?.message || 'Upload request is invalid');
      return directJson(await createApi(env, crypto.randomUUID(), context)('/v1/media:requestUpload', { method: 'POST', operation: 'upload_media', mutation: true, body: parsed.data }), 201);
    }
    const match = url.pathname.match(/^\/media-upload\/([A-Za-z0-9][A-Za-z0-9._:-]{0,199})$/); if (!match) return directError(404, 'NOT_FOUND', 'Direct media route was not found');
    if (request.method !== 'PUT') return directError(405, 'METHOD_NOT_ALLOWED', 'Use PUT');
    const mimeType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase(); const digest = request.headers.get('x-content-sha256'); const token = request.headers.get('x-upload-token'); const declared = Number(request.headers.get('content-length'));
    if (!uploadRequest.shape.mimeType.safeParse(mimeType).success || !hash.safeParse(digest).success || typeof token !== 'string' || token.length < 16 || !Number.isInteger(declared) || declared < 1 || declared > 25 * 1024 * 1024) return directError(422, 'UPLOAD_HEADERS_INVALID', 'Upload headers are invalid');
    const bytes = new Uint8Array(await request.arrayBuffer()); if (bytes.byteLength !== declared) return directError(413, 'SIZE_MISMATCH', 'Content-Length does not match uploaded bytes');
    if (context?.bearerToken) { const identity = await verifyCapability(env, context.bearerToken, { operation: 'upload_media' }); authorise(identity, 'upload_media'); }
    const response = await env.CONTENT_API.fetch(new Request(`https://content-api.internal/v1/media/uploads/${encodeURIComponent(match[1])}`, { method: 'PUT', headers: { ...(context?.bearerToken ? { authorization: `Bearer ${context.bearerToken}` } : {}), 'content-type': mimeType, 'content-length': String(bytes.byteLength), 'x-content-sha256': digest, 'x-upload-token': token }, body: bytes }));
    const body = await response.json(); if (!response.ok) return directError(response.status, body.error?.code || 'UPLOAD_FAILED', body.error?.message || 'Upload failed'); return directJson(body, 202);
  } catch (error) { return directError(502, 'CAPABILITY_OR_CONTENT_API_ERROR', error instanceof Error ? error.message : 'Request failed'); }
}

export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET' && (url.pathname === '/.well-known/oauth-protected-resource' || url.pathname === '/.well-known/oauth-protected-resource/mcp')) {
    return directJson({ resource: MCP_RESOURCE, authorization_servers: [AUTHORIZATION_SERVER], scopes_supported: ['content:read', 'content:write', 'media:read', 'media:upload'], resource_documentation: 'https://ethicsandai.your-digital-life.org/' });
  }
  if (request.method === 'PUT' && /^\/media-upload\/[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(url.pathname)) return handleDirectMediaUpload(request, env, null);
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  try {
    const identity = await verifyCapability(env, token);
    const context = { bearerToken: token, identity };
    if (url.pathname.startsWith('/media-upload/')) return handleDirectMediaUpload(request, env, context);
    if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined }); const server = createMcp(env, identity.runId, context); await server.connect(transport); return transport.handleRequest(request);
  } catch { return new Response('Unauthorized', { status: 401, headers: { 'www-authenticate': `Bearer resource_metadata="${MCP_RESOURCE_METADATA}", scope="content:read", error="invalid_token"`, 'cache-control': 'no-store' } }); }
} };
