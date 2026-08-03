import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

const instructions = 'Read chapters and passages first. Create or resume a changeset, make semantic edits, validate, inspect the diff, then submit. Approval and publication require a separate human release path and are not available through this MCP server. Every mutation carries the current preconditions and idempotency key. Never use raw HTML, CSS, SQL, or database patches.';
const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const checkpointSlot = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
const uuid = z.string().uuid();
const write = { changeSetId: id, documentId: id.optional(), baseRevisionId: id, expectedVersion: z.number().int().positive(), idempotencyKey: uuid };
const documentPrecondition = z.object({ documentId: id, baseRevisionId: id, expectedVersion: z.number().int().positive() }).strict();
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true };
const mutates = { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true };
const destructiveDraft = { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: true };
const position = z.union([z.object({ beforeBlockId: id }).strict(), z.object({ afterBlockId: id }).strict()]);
const checkpoint = z.object({ checkpointId: id.optional(), legacyId: z.string().min(1).max(200).optional(), passageId: id, passageExcerptHash: z.string().regex(/^[a-f0-9]{64}$/), slot: checkpointSlot, stage: z.string().min(1).max(120), strategy: z.enum(['initial-judgment', 'self-explanation', 'argument-reconstruction', 'evidence-warrant', 'contrast-case', 'counterexample', 'consider-alternative', 'objection-repair', 'question-generation', 'epistemic-calibration', 'framework-comparison', 'transfer', 'metacognitive-trace']), title: z.string().min(1).max(200), trigger: z.string().min(1).max(300), prompt: z.string().min(1).max(4000), guidance: z.string().min(1).max(2000), responseStructure: z.enum(['prose', 'movement-plus-prose']), minWords: z.number().int().min(1).max(1000), maxWords: z.number().int().min(1).max(1000), rationale: z.string().min(1).max(2000), showInSidebar: z.boolean() }).strict().refine(v => v.minWords <= v.maxWords, 'minWords must not exceed maxWords');
const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().min(1).max(50000) }).strict(),
  z.object({ type: z.literal('heading'), text: z.string().min(1).max(1000), level: z.number().int().min(2).max(6) }).strict(),
  z.object({ type: z.literal('blockquote'), text: z.string().min(1).max(50000) }).strict(),
  z.object({ type: z.literal('callout'), text: z.string().min(1).max(20000), tone: z.enum(['note', 'warning', 'example', 'question']) }).strict(),
  z.object({ type: z.literal('list'), ordered: z.boolean(), items: z.array(z.string().min(1).max(4000)).min(1).max(100) }).strict(),
  z.object({ type: z.literal('codeBlock'), code: z.string().min(1).max(50000), language: z.string().min(1).max(50).optional() }).strict(),
  z.object({ type: z.literal('table'), rows: z.array(z.array(z.string().min(1).max(4000)).min(1).max(20)).min(1).max(100) }).strict(),
  z.object({ type: z.literal('diagram'), diagramId: id, alt: z.string().min(1).max(1000) }).strict()
]);
const chapterBodyItem = z.union([
  z.object({ blockId: id, preserve: z.literal(true) }).strict(),
  ...block.options.map(schema => schema.extend({ blockId: id.optional() }).strict())
]);
const fallback = z.object({ title: z.string().min(1).max(300), summary: z.string().min(1).max(4000), posterAssetId: id.optional(), transcript: z.string().min(1).max(20000).optional(), linkLabel: z.string().min(1).max(120), creator: z.string().min(1).max(300).optional(), publishedAt: z.string().datetime().optional(), accessedAt: z.string().datetime() }).strict();
const providerIdentity = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('youtube'), resourceType: z.enum(['video', 'playlist']), resourceId: z.string().min(1).max(300) }).strict(),
  z.object({ provider: z.literal('vimeo'), resourceType: z.literal('video'), resourceId: z.string().min(1).max(300), unlistedHash: z.string().min(1).max(200).optional() }).strict(),
  z.object({ provider: z.literal('x'), resourceType: z.literal('post'), resourceId: z.string().min(1).max(300) }).strict(),
  z.object({ provider: z.literal('spotify'), resourceType: z.enum(['artist', 'album', 'track', 'show', 'episode']), resourceId: z.string().min(1).max(300) }).strict(),
  z.object({ provider: z.literal('soundcloud'), resourceType: z.enum(['user', 'set', 'track']), resourceId: z.string().min(1).max(300) }).strict(),
  z.object({ provider: z.literal('bluesky'), resourceType: z.literal('post'), resourceId: z.string().min(1).max(300) }).strict()
]);
const embed = z.union([
  z.object({ kind: z.literal('externalEmbed'), embedId: id.optional(), anchorPassageId: id.optional(), identity: providerIdentity, canonicalUrl: z.string().url().startsWith('https://'), caption: z.string().min(1).max(2000), teachingUse: z.string().min(1).max(2000), displayPreset: z.enum(['compact', 'reading', 'wide']), theme: z.enum(['light', 'dark', 'auto']), fallback, adapterVersion: z.string().min(1).max(100) }).strict(),
  z.object({ kind: z.literal('richLink'), linkId: id.optional(), anchorPassageId: id.optional(), canonicalUrl: z.string().url().startsWith('https://'), title: z.string().min(1).max(300), summary: z.string().min(1).max(4000), teachingUse: z.string().min(1).max(2000), linkLabel: z.string().min(1).max(120), posterMediaVersionId: id.optional(), accessedAt: z.string().datetime() }).strict()
]);
const media = z.object({ mediaId: id, mediaVersionId: id, figureId: id.optional(), anchorPassageId: id.optional(), rightsCaseId: id, decorative: z.boolean(), alt: z.string().max(2000).optional(), caption: z.string().max(4000).optional(), captionOmissionReason: z.string().max(1000).optional(), teachingUse: z.string().min(1).max(2000), creditOverride: z.string().max(1000).optional(), displayPreset: z.enum(['narrow', 'reading', 'wide', 'bleed']), align: z.enum(['start', 'center', 'end']), animationPolicy: z.enum(['clickToPlay', 'playOnce', 'loopWithControls']).optional(), printPolicy: z.enum(['poster', 'firstFrame', 'omit']), downloadable: z.boolean() }).strict().refine(v => v.decorative || Boolean(v.alt), 'Nondecorative media requires alt text').refine(v => Boolean(v.caption || v.captionOmissionReason), 'Caption or omission reason is required').refine(v => !(v.caption && v.captionOmissionReason), 'Provide caption or captionOmissionReason, not both');
const uploadRequest = { reviewPackageId: id, filename: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/), mimeType: z.enum(['image/png','image/jpeg','image/gif','image/webp','audio/mpeg','audio/wav','audio/mp4','video/mp4','video/webm','application/pdf','text/plain']), bytes: z.number().int().min(1).max(25 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/), idempotencyKey: uuid, transcriptEquivalent: z.object({ provided: z.literal(true), language: z.string().min(1).max(40), text: z.string().min(1).max(50000) }).strict().optional(), poster: z.object({ provided: z.literal(true), alt: z.string().min(1).max(2000) }).strict().optional() };
const asResult = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data });
const DEFAULT_IDENTITY = Object.freeze({ actorId: 'actor_textbook_mcp', actorType: 'agent', clientId: 'textbook-mcp', runId: 'run_textbook_mcp', scopes: ['content:read', 'content:write', 'content:submit', 'media:read', 'media:upload'] });
const CAPABILITY_ISSUER = 'ai-ethics-editor';
const CAPABILITY_AUDIENCE = 'ai-ethics-textbook-mcp';
const allowedAgentScopes = new Set(DEFAULT_IDENTITY.scopes);
const utf8 = new TextEncoder();
const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decodeBase64url = (value) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), (character) => character.charCodeAt(0));
async function capabilitySignature(payload, secret) {
  const key = await crypto.subtle.importKey('raw', utf8.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8.encode(payload)));
}
export async function signAgentCapability(claims, secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Capability signing secret must be at least 32 characters');
  const payload = base64url(utf8.encode(JSON.stringify(claims)));
  return `cap1.${payload}.${base64url(await capabilitySignature(payload, secret))}`;
}
export async function verifyAgentCapability(token, secret, epochSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || typeof secret !== 'string' || secret.length < 32) throw new Error('Capability unavailable');
  const match = token.match(/^cap1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/); if (!match) throw new Error('Capability format invalid');
  const supplied = decodeBase64url(match[2]);
  const verificationKey = await crypto.subtle.importKey('raw', utf8.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('HMAC', verificationKey, supplied, utf8.encode(match[1]))) throw new Error('Capability signature invalid');
  let claims; try { claims = JSON.parse(new TextDecoder().decode(decodeBase64url(match[1]))); } catch { throw new Error('Capability payload invalid'); }
  if (claims.iss !== CAPABILITY_ISSUER || claims.aud !== CAPABILITY_AUDIENCE || claims.actorType !== 'agent') throw new Error('Capability audience or identity invalid');
  if (!/^actor_[A-Za-z0-9][A-Za-z0-9_-]{2,120}$/.test(claims.sub || '') || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,120}$/.test(claims.clientId || '') || !/^run_[A-Za-z0-9][A-Za-z0-9_-]{2,120}$/.test(claims.runId || '')) throw new Error('Capability identity invalid');
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.iat > epochSeconds + 60 || claims.exp <= epochSeconds || claims.exp - claims.iat > 3600) throw new Error('Capability expired or lifetime invalid');
  if (!Array.isArray(claims.scopes) || !claims.scopes.length || claims.scopes.some((scope) => !allowedAgentScopes.has(scope))) throw new Error('Capability scopes invalid');
  return { actorId: claims.sub, actorType: 'agent', clientId: claims.clientId, runId: claims.runId, scopes: [...new Set(claims.scopes)].sort(), expiresAt: new Date(claims.exp * 1000).toISOString() };
}
const hasScope = (identity, ...required) => required.some((scope) => identity.scopes.includes(scope));

function api(env, requestId, identity = DEFAULT_IDENTITY) {
  return async (path, method = 'GET', body) => {
    const response = await env.CONTENT_API.fetch(new Request(`https://content-api.internal${path}`, { method, headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), 'x-content-gateway-verified': 'v1', 'x-content-actor-id': identity.actorId, 'x-content-actor-type': 'agent', 'x-content-client-id': identity.clientId, 'x-content-run-id': identity.runId || requestId, 'x-content-scopes': identity.scopes.join(' ') }, ...(body ? { body: JSON.stringify(body) } : {}) }));
    const data = await response.json(); if (!response.ok) throw new Error(`${response.status} ${data.error?.code ?? 'CONTENT_API_ERROR'}: ${data.error?.message ?? 'Request failed'}`); return data;
  };
}
function uploadApi(env, requestId, identity = DEFAULT_IDENTITY) { return async ({ ticketId, token, mimeType, sha256, bytes }) => { const response = await env.CONTENT_API.fetch(new Request(`https://content-api.internal/v1/media/uploads/${encodeURIComponent(ticketId)}`, { method: 'PUT', headers: { 'content-type': mimeType, 'content-length': String(bytes.byteLength), 'x-content-sha256': sha256, 'x-upload-token': token, 'x-content-gateway-verified': 'v1', 'x-content-actor-id': identity.actorId, 'x-content-actor-type': 'agent', 'x-content-client-id': identity.clientId, 'x-content-run-id': identity.runId || requestId, 'x-content-scopes': identity.scopes.join(' ') }, body: bytes })); const data = await response.json(); if (!response.ok) throw new Error(`${response.status} ${data.error?.code ?? 'UPLOAD_FAILED'}`); return data; }; }
export function createMcp(env, requestId = crypto.randomUUID(), identity = DEFAULT_IDENTITY) {
  const call = api(env, requestId, identity); const server = new McpServer({ name: 'ai-ethics-textbook', version: '0.2.0' }, { instructions });
  server.registerTool('list_chapters', { title: 'List Chapters', description: 'Read active canonical chapters.', outputSchema: { chapters: z.array(z.object({ id, title: z.string().optional(), current_revision_id: id.optional() }).passthrough()) }, annotations: readOnly }, async () => asResult(await call('/v1/chapters')));
  server.registerTool('get_chapter', { title: 'Get Chapter', description: 'Read one canonical chapter and its current revision.', inputSchema: { chapterId: id }, annotations: readOnly }, async ({ chapterId }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}`)));
  server.registerTool('list_passages', { title: 'List Passage Anchors', description: 'Read a bounded page of stable passage anchors before changing anchored content. Follow page.nextCursor until null when exhaustive inspection is required.', inputSchema: { chapterId: id, limit: z.number().int().min(1).max(100).optional(), cursor: z.number().int().min(0).max(10000).optional() }, annotations: readOnly }, async ({ chapterId, limit = 100, cursor = 0 }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/passages?limit=${limit}&cursor=${cursor}`)));
  server.registerTool('get_passage', { title: 'Get Passage', description: 'Read one exact stable passage, including its typed block and current chapter revision.', inputSchema: { chapterId: id, passageId: id }, annotations: readOnly }, async ({ chapterId, passageId }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/passages/${encodeURIComponent(passageId)}`)));
  server.registerTool('get_passage_dependencies', { title: 'Get Passage Dependencies', description: 'Read a bounded page of checkpoint, embed, and media dependencies for one stable passage. Follow page.nextCursor until null.', inputSchema: { chapterId: id, passageId: id, limit: z.number().int().min(1).max(100).optional(), cursor: z.number().int().min(0).max(10000).optional() }, annotations: readOnly }, async ({ chapterId, passageId, limit = 100, cursor = 0 }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/dependencies?passageId=${encodeURIComponent(passageId)}&limit=${limit}&cursor=${cursor}`)));
  server.registerTool('get_changeset', { title: 'Get Changeset Evidence', description: 'Inspect working documents, immutable submitted snapshot identity, and any recorded human release decision.', inputSchema: { changeSetId: id }, annotations: readOnly }, async ({ changeSetId }) => asResult(await call(`/v1/changesets/${encodeURIComponent(changeSetId)}`)));
  server.registerTool('get_release', { title: 'Get Release Evidence', description: 'Inspect release provenance, frozen authority map, approval records, submitted snapshot identity, and active-pointer state.', inputSchema: { releaseId: id }, annotations: readOnly }, async ({ releaseId }) => asResult(await call(`/v1/releases/${encodeURIComponent(releaseId)}`)));
  server.registerTool('list_revisions', { title: 'List Chapter Revisions', description: 'Read bounded immutable revision receipts without loading chapter prose.', inputSchema: { chapterId: id, limit: z.number().int().min(1).max(50).optional(), cursor: z.number().int().min(0).max(10000).optional() }, annotations: readOnly }, async ({ chapterId, limit = 20, cursor = 0 }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/revisions?limit=${limit}&cursor=${cursor}`)));
  server.registerTool('restore_revision_as_draft', { title: 'Restore Revision as Draft', description: 'Create a new draft changeset from a prior revision; does not publish or replace canonical content.', inputSchema: { chapterId: id, revisionId: id, title: z.string().min(1).max(200), idempotencyKey: uuid }, annotations: mutates }, async ({ chapterId, revisionId, ...body }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/revisions/${encodeURIComponent(revisionId)}:restoreAsDraft`, 'POST', body)));
  server.registerTool('create_or_resume_changeset', { title: 'Create or Resume Changeset', description: 'Open a chapter-scoped draft changeset.', inputSchema: { chapterId: id, title: z.string().min(1).max(200), description: z.string().max(2000).optional(), resume: z.boolean().optional(), idempotencyKey: uuid }, annotations: mutates }, async ({ chapterId, ...body }) => asResult(await call(`/v1/chapters/${encodeURIComponent(chapterId)}/changesets`, 'POST', body)));
  server.registerTool('create_changeset', { title: 'Create Multi-Chapter Changeset', description: 'Open one isolated draft spanning 1-18 chapters. Every later mutation names its document target, and review submission binds all document preconditions atomically.', inputSchema: { targets: z.array(id).min(1).max(18), title: z.string().min(1).max(200), description: z.string().max(2000).optional(), idempotencyKey: uuid }, annotations: mutates }, async (body) => asResult(await call('/v1/changesets', 'POST', body)));
  const operation = (name, title, description, schema, annotations = mutates) => server.registerTool(name, { title, description, inputSchema: { ...write, operation: schema }, annotations }, async ({ changeSetId, documentId, baseRevisionId, expectedVersion, idempotencyKey, operation }) => asResult(await call(`/v1/changesets/${encodeURIComponent(changeSetId)}:apply`, 'POST', { ...(documentId ? { documentId } : {}), baseRevisionId, expectedVersion, idempotencyKey, operation })));
  operation('replace_text', 'Replace Text', 'Replace text in a named block; not raw markup.', z.object({ type: z.literal('text.replace'), blockId: id, text: z.string().min(1).max(12000) }).strict());
  operation('replace_chapter_body', 'Replace Chapter Body', 'Atomically replace the continuous chapter body. Reuse blockId for existing editable blocks, use {blockId,preserve:true} for managed media/embed/legacy blocks, and omit blockId for new blocks. The server preserves anchors and rejects orphaned dependencies.', z.object({ type: z.literal('chapter.replaceBody'), body: z.array(chapterBodyItem).min(1).max(2000) }).strict(), destructiveDraft);
  operation('insert_block', 'Insert Block', 'Insert a typed content block at a stable before/after location; stable IDs are assigned by the server.', z.object({ type: z.literal('block.insert'), position, block }).strict());
  operation('move_block', 'Move Block', 'Move a block without recreating it.', z.object({ type: z.literal('block.move'), blockId: id, position }).strict());
  operation('remove_block', 'Remove Block', 'Remove a non-legacy structured block. Anchored dependents require an explicit stable replacement passage.', z.object({ type: z.literal('block.remove'), blockId: id, replacementPassageId: id.optional() }).strict(), destructiveDraft);
  operation('upsert_checkpoint', 'Upsert Checkpoint', 'Create or replace one anchored checkpoint in an ordered collection of any length.', z.object({ type: z.enum(['checkpoint.upsert', 'checkpoint.replace']), checkpoint }).strict());
  operation('remove_checkpoint', 'Remove Checkpoint', 'Remove a checkpoint by stable ID or internal key.', z.object({ type: z.literal('checkpoint.remove'), slot: checkpointSlot.optional(), checkpointId: id.optional() }).strict().refine((value) => Boolean(value.slot || value.checkpointId), 'slot or checkpointId is required'));
  operation('upsert_embed', 'Upsert Embed', 'Insert or update a registered external embed or authored rich link; new blocks require a stable position.', z.object({ type: z.literal('embed.upsert'), embed, position: position.optional() }).strict());
  operation('place_media', 'Place Media', 'Place or update an approved accessible media version; new figures require a stable position.', z.object({ type: z.literal('media.place'), placement: media, position: position.optional() }).strict());
  operation('remove_media', 'Remove Media', 'Remove a placed media figure by stable figure ID.', z.object({ type: z.literal('media.remove'), figureId: id }).strict());
  server.registerTool('create_media_review_package', { title: 'Create Pending Media Review Package', description: 'Persist structured rights, teaching-use, and accessibility declarations. The result remains pending until a human clears or blocks the exact declaration hash.', inputSchema: {
    rights: z.object({ basis: z.enum(['owned', 'licensed', 'permission', 'publicDomain', 'fairUse', 'unknown']), creator: z.string().min(1).max(300), sourceUrl: z.string().url().startsWith('https://').optional(), license: z.string().min(1).max(300).optional(), attribution: z.string().min(1).max(1000), permissionEvidenceRef: z.string().min(1).max(300).optional(), notes: z.string().min(1).max(2000).optional() }).strict(),
    editorial: z.object({ teachingUse: z.string().min(1).max(2000), placementIntent: z.string().min(1).max(1000), notes: z.string().min(1).max(2000).optional() }).strict(),
    accessibility: z.object({ decorative: z.boolean(), altText: z.string().min(1).max(1000).optional(), transcriptEquivalent: z.object({ language: z.string().min(1).max(40), text: z.string().min(1).max(50000) }).strict().optional(), motionReview: z.enum(['notApplicable', 'pending', 'passed', 'failed']).optional(), notes: z.string().min(1).max(2000).optional() }).strict(),
    idempotencyKey: uuid
  }, annotations: mutates }, async (body) => asResult(await call('/v1/media-review-packages', 'POST', body)));
  server.registerTool('search_media', { title: 'Search Media', description: 'Search ready immutable media versions for reuse, with optional rights and kind filters.', inputSchema: { query: z.string().max(100).optional(), kind: z.enum(['image', 'audio', 'video', 'document']).optional(), rightsStatus: z.enum(['reviewRequired', 'cleared', 'blocked']).optional(), sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), limit: z.number().int().min(1).max(50).optional(), cursor: z.number().int().min(0).max(10000).optional() }, annotations: readOnly }, async ({ query, kind, rightsStatus, sha256, limit, cursor }) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query); if (kind) params.set('kind', kind); if (rightsStatus) params.set('rightsStatus', rightsStatus); if (sha256) params.set('sha256', sha256); if (limit) params.set('limit', String(limit)); if (cursor !== undefined) params.set('cursor', String(cursor));
    return asResult(await call(`/v1/media${params.size ? `?${params}` : ''}`));
  });
  server.registerTool('resolve_provider_url', { title: 'Resolve Provider URL', description: 'Resolve a supported provider URL using the server-owned registry; unsupported URLs return a rich-link proposal and no network fetch occurs.', inputSchema: { url: z.string().url().startsWith('https://'), expectedProvider: z.enum(['youtube', 'vimeo', 'x', 'spotify', 'soundcloud', 'bluesky']).optional() }, annotations: readOnly }, async (body) => asResult(await call('/v1/embeds:resolve', 'POST', body)));
  server.registerTool('get_media_job', { title: 'Get Media Job', description: 'Read processing state for an upload job.', inputSchema: { jobId: id }, annotations: readOnly }, async ({ jobId }) => asResult(await call(`/v1/media/jobs/${encodeURIComponent(jobId)}`)));
  server.registerTool('get_media_asset', { title: 'Get Media Asset', description: 'Read the finalized media asset and its immutable versions.', inputSchema: { mediaId: id }, annotations: readOnly }, async ({ mediaId }) => asResult(await call(`/v1/media/${encodeURIComponent(mediaId)}`)));
  server.registerTool('validate_changeset', { title: 'Validate Changeset', description: 'Validate the current draft before review.', inputSchema: { changeSetId: id }, annotations: mutates }, async ({ changeSetId }) => asResult(await call(`/v1/changesets/${encodeURIComponent(changeSetId)}:validate`, 'POST')));
  server.registerTool('render_preview', { title: 'Render Protected Preview', description: 'Freeze one working document into an immutable five-minute, one-time, read-only preview URL. documentId is required for multi-document changesets. The URL contains no authoring credential.', inputSchema: { ...write, surface: z.enum(['web', 'mobile', 'print', 'offline']).optional() }, annotations: mutates }, async ({ changeSetId, documentId, baseRevisionId, expectedVersion, idempotencyKey, surface }) => asResult(await call(`/v1/changesets/${encodeURIComponent(changeSetId)}:renderPreview`, 'POST', { ...(documentId ? { documentId } : {}), baseRevisionId, expectedVersion, idempotencyKey, ...(surface ? { surface } : {}) })));
  server.registerTool('diff_changeset', { title: 'Diff Changeset', description: 'Read bounded semantic diffs between canonical and working content. Omit documentId to receive every document in a multi-chapter changeset.', inputSchema: { changeSetId: id, documentId: id.optional() }, annotations: readOnly }, async ({ changeSetId, documentId }) => asResult(await call(`/v1/changesets/${encodeURIComponent(changeSetId)}:diff`, 'POST', documentId ? { documentId } : {})));
  server.registerTool('submit_changeset', { title: 'Submit Changeset', description: 'Atomically freeze a validated changeset for human review. For multiple chapters, documents must contain exact preconditions for every target; the submission fails if any one is stale.', inputSchema: { changeSetId: id, baseRevisionId: id.optional(), expectedVersion: z.number().int().positive().optional(), documents: z.array(documentPrecondition).min(1).max(18).optional(), idempotencyKey: uuid }, annotations: mutates }, async ({ changeSetId, baseRevisionId, expectedVersion, documents, idempotencyKey }) => asResult(await call(`/v1/changesets/${encodeURIComponent(changeSetId)}:submitReview`, 'POST', { ...(baseRevisionId ? { baseRevisionId } : {}), ...(expectedVersion ? { expectedVersion } : {}), ...(documents ? { documents } : {}), idempotencyKey })));
  const scopeByTool = {
    list_chapters: ['content:read'], get_chapter: ['content:read'], list_passages: ['content:read'], get_passage: ['content:read'], get_passage_dependencies: ['content:read'], get_changeset: ['content:read'], get_release: ['content:read'], list_revisions: ['content:read'],
    restore_revision_as_draft: ['content:write'], create_or_resume_changeset: ['content:write'], create_changeset: ['content:write'], replace_text: ['content:write'], replace_chapter_body: ['content:write'], insert_block: ['content:write'], move_block: ['content:write'], remove_block: ['content:write'], upsert_checkpoint: ['content:write'], remove_checkpoint: ['content:write'], upsert_embed: ['content:write'], place_media: ['content:write'], remove_media: ['content:write'], resolve_provider_url: ['content:write'], validate_changeset: ['content:write'], render_preview: ['content:write'],
    create_media_review_package: ['media:upload', 'content:write'], search_media: ['media:read', 'content:read'], get_media_job: ['media:read', 'content:read'], get_media_asset: ['media:read', 'content:read'], diff_changeset: ['content:read'], submit_changeset: ['content:submit']
  };
  for (const [name, tool] of Object.entries(server._registeredTools)) if (!hasScope(identity, ...(scopeByTool[name] || []))) tool.disable();
  server.registerResource('Agent capability receipt', 'textbook://capabilities', { title: 'Agent capability receipt', description: 'Current authenticated agent identity, scopes, and hard authority boundary.', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ actorId: identity.actorId, clientId: identity.clientId, runId: identity.runId, scopes: identity.scopes, expiresAt: identity.expiresAt || null, cannot: ['approve', 'reject', 'publish', 'change authority', 'write D1 or R2 directly'] }) }] }));
  if (hasScope(identity, 'content:read')) {
    server.registerResource('Chapter index', 'textbook://chapters', { title: 'Canonical chapter index', description: 'Current canonical chapter identities and revision heads.', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await call('/v1/chapters')) }] }));
    server.registerResource('Content API schema', 'textbook://schema', { title: 'Content API semantic operation schema', description: 'Versioned server-owned operation and safety contract.', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await call('/v1/schema')) }] }));
  }
  return server;
}

const directJson = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
const directError = (status, code, message) => directJson({ error: { code, message } }, status);

export async function handleDirectMediaUpload(request, env, identity = DEFAULT_IDENTITY) {
  const url = new URL(request.url);
  const requestId = crypto.randomUUID();
  try {
    if (url.pathname === '/media-upload/request') {
      if (request.method !== 'POST') return directError(405, 'METHOD_NOT_ALLOWED', 'Use POST');
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 32768) return directError(413, 'BODY_TOO_LARGE', 'Upload request metadata is too large');
      let body; try { body = JSON.parse(raw); } catch { return directError(400, 'INVALID_JSON', 'Upload request metadata must be valid JSON'); }
      const parsed = z.object(uploadRequest).strict().safeParse(body);
      if (!parsed.success) return directError(422, 'UPLOAD_REQUEST_INVALID', parsed.error.issues[0]?.message || 'Upload request is invalid');
      if (!hasScope(identity, 'media:upload')) return directError(403, 'FORBIDDEN', 'media:upload scope is required');
      return directJson(await api(env, requestId, identity)('/v1/media:requestUpload', 'POST', parsed.data), 201);
    }
    const match = url.pathname.match(/^\/media-upload\/([A-Za-z0-9][A-Za-z0-9._:-]{0,199})$/);
    if (!match) return directError(404, 'NOT_FOUND', 'Direct media route was not found');
    if (request.method !== 'PUT') return directError(405, 'METHOD_NOT_ALLOWED', 'Use PUT');
    const mimeType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    const token = request.headers.get('x-upload-token');
    const digest = request.headers.get('x-content-sha256');
    const declared = Number(request.headers.get('content-length'));
    if (!uploadRequest.mimeType.safeParse(mimeType).success || !uploadRequest.sha256.safeParse(digest).success || typeof token !== 'string' || token.length < 16 || !Number.isInteger(declared) || declared < 1 || declared > 25 * 1024 * 1024) return directError(422, 'UPLOAD_HEADERS_INVALID', 'Upload headers are invalid');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength !== declared) return directError(413, 'SIZE_MISMATCH', 'Content-Length does not match uploaded bytes');
    if (!hasScope(identity, 'media:upload')) return directError(403, 'FORBIDDEN', 'media:upload scope is required');
    return directJson(await uploadApi(env, requestId, identity)({ ticketId: match[1], token, mimeType, sha256: digest, bytes }), 202);
  } catch (error) {
    return directError(502, 'CONTENT_API_ERROR', error instanceof Error ? error.message : 'Content API request failed');
  }
}

export default { async fetch(request, env) {
  const url = new URL(request.url);
  const supplied = request.headers.get('authorization');
  const token = supplied?.match(/^Bearer (.+)$/)?.[1]; let identity;
  try {
    if (token && env.MCP_CAPABILITY_SECRET) identity = await verifyAgentCapability(token, env.MCP_CAPABILITY_SECRET);
    else if (env.MCP_ALLOW_LEGACY_TOKEN === '1' && token && env.MCP_ACCESS_TOKEN && token === env.MCP_ACCESS_TOKEN) identity = DEFAULT_IDENTITY;
    else throw new Error('missing capability');
  } catch { return new Response('Unauthorized', { status: 401, headers: { 'www-authenticate': 'Bearer realm="ai-ethics-textbook-mcp", error="invalid_token"' } }); }
  if (url.pathname.startsWith('/media-upload/')) return handleDirectMediaUpload(request, env, identity);
  if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined }); const server = createMcp(env, identity.runId, identity); await server.connect(transport); return transport.handleRequest(request);
} };
