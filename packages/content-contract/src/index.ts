/** Versioned source contract for the authoring and release planes. */
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const CONTENT_CONTRACT_VERSION = "2.0.0";
export const CONTENT_SCHEMA_VERSION = 3 as const;
export const LEGACY_CONTENT_SCHEMA_VERSION = 2 as const;
const id = (kind: string) => z.string().regex(new RegExp(`^${kind}_[A-Za-z0-9][A-Za-z0-9_-]*$`));
const mediaVersionId = z.string().regex(/^(?:mediaVersion|mediaversion)_[A-Za-z0-9][A-Za-z0-9_-]*$/);
const rightsCaseId = z.string().regex(/^(?:rights|rightscase)_[A-Za-z0-9][A-Za-z0-9_-]*$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/i);
const time = z.string().datetime({ offset: true });
const text = z.string().trim().min(1).max(20_000);
const transcriptText = z.string().trim().min(1).max(50_000);
const https = z.string().url().refine((v) => new URL(v).protocol === "https:", "HTTPS is required");
const url = z.string().url();
const relativePath = z.string().min(1).refine((v) => !v.startsWith("/") && !v.includes(".."), "must be repo-relative");

export const ActorReferenceSchema = z.object({ actorId: id("actor"), actorType: z.enum(["human", "agent", "service"]), displayName: text.max(200).optional() }).strict();
export const PartReferenceSchema = z.object({ partId: id("part"), title: text.max(300), order: z.number().int().positive() }).strict();
export const IdentityAliasSchema = z.object({ fromId: text, toId: text, reason: text, createdAt: time }).strict();
export const IdentityTombstoneSchema = z.object({ id: text, reason: text, retiredAt: time, replacementId: text.optional() }).strict();
export type ActorReference = z.infer<typeof ActorReferenceSchema>;

const BlockBase = z.object({ blockId: id("block"), anchorPassageId: id("passage").optional() }).strict();
const TextBlock = BlockBase.extend({ text });
export const ProviderIdentitySchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("youtube"), resourceType: z.enum(["video", "playlist"]), resourceId: text }).strict(),
  z.object({ provider: z.literal("vimeo"), resourceType: z.literal("video"), resourceId: text, unlistedHash: text.optional() }).strict(),
  z.object({ provider: z.literal("x"), resourceType: z.literal("post"), resourceId: text }).strict(),
  z.object({ provider: z.literal("spotify"), resourceType: z.enum(["track", "album", "playlist", "episode", "show"]), resourceId: text }).strict(),
  z.object({ provider: z.literal("soundcloud"), resourceType: z.enum(["user", "track", "set"]), resourceId: text }).strict(),
  z.object({ provider: z.literal("bluesky"), resourceType: z.literal("post"), resourceId: text }).strict(),
]);
const ProviderOptionsSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("youtube"), startSeconds: z.number().int().nonnegative().optional(), captions: z.boolean().default(true) }).strict(),
  z.object({ provider: z.literal("vimeo"), startSeconds: z.number().int().nonnegative().optional(), dnt: z.literal(true) }).strict(),
  z.object({ provider: z.literal("x"), conversation: z.boolean().default(true), theme: z.enum(["light", "dark"]).optional() }).strict(),
  z.object({ provider: z.literal("spotify"), explicitConsent: z.literal(true) }).strict(),
  z.object({ provider: z.literal("soundcloud"), linkFirst: z.literal(true) }).strict(),
  z.object({ provider: z.literal("bluesky"), linkFirst: z.literal(true) }).strict(),
]);

export const MediaFigureSchema = BlockBase.extend({
  type: z.literal("mediaFigure"), figureId: id("figure"), mediaId: id("media"), mediaVersionId, rightsCaseId, decorative: z.boolean(), alt: text.max(2_000).optional(), caption: text.optional(), captionOmissionReason: text.optional(), teachingUse: text, creditOverride: text.optional(), displayPreset: z.enum(["narrow", "reading", "wide", "bleed"]), align: z.enum(["start", "center", "end"]), animationPolicy: z.enum(["clickToPlay", "playOnce", "loopWithControls"]).optional(), printPolicy: z.enum(["poster", "firstFrame", "omit"]), downloadable: z.boolean(), editorialApprovalId: id("approval").optional(),
}).superRefine((v, ctx) => {
  if (!v.decorative && !v.alt) ctx.addIssue({ code: "custom", path: ["alt"], message: "Nondecorative media requires alt text" });
  if (!v.caption && !v.captionOmissionReason) ctx.addIssue({ code: "custom", path: ["captionOmissionReason"], message: "Caption or omission reason required" });
});
export const ExternalEmbedSchema = BlockBase.extend({
  type: z.literal("externalEmbed"), embedId: id("embed"), identity: ProviderIdentitySchema, canonicalUrl: https, caption: text, teachingUse: text, displayPreset: z.enum(["compact", "reading", "wide"]), theme: z.enum(["light", "dark", "auto"]), options: ProviderOptionsSchema,
  fallback: z.object({ title: text, summary: text, posterAssetId: mediaVersionId.optional(), transcript: text.optional(), linkLabel: text, creator: text.optional(), publishedAt: time.optional(), accessedAt: time }).strict(), adapterVersion: text, editorialApprovalId: id("approval").optional(),
}).superRefine((v, ctx) => { if (v.identity.provider !== v.options.provider) ctx.addIssue({ code: "custom", path: ["options"], message: "Provider options do not match identity" }); });
export const RichLinkBlockSchema = BlockBase.extend({ type: z.literal("richLink"), linkId: id("link"), canonicalUrl: https, title: text, summary: text, teachingUse: text, linkLabel: text, posterMediaVersionId: mediaVersionId.optional(), accessedAt: time, editorialApprovalId: id("approval").optional() });

// Some member schemas have cross-field refinements; Zod's discriminatedUnion
// accepts only bare objects, so use a union here to retain those safeguards.
export const ChapterBlockSchema = z.union([
  BlockBase.extend({ type: z.literal("heading"), sectionId: id("section"), level: z.number().int().min(2).max(6), text }),
  TextBlock.extend({ type: z.literal("paragraph"), passageId: id("passage") }),
  TextBlock.extend({ type: z.literal("list"), passageId: id("passage"), ordered: z.boolean(), items: z.array(text).min(1) }),
  TextBlock.extend({ type: z.literal("blockquote"), passageId: id("passage"), attribution: text.optional() }),
  BlockBase.extend({ type: z.literal("codeBlock"), language: text.optional(), code: z.string().min(1) }),
  BlockBase.extend({ type: z.literal("table"), passageId: id("passage"), columns: z.array(text).min(1), rows: z.array(z.array(text).min(1)).min(1) }),
  TextBlock.extend({ type: z.literal("callout"), passageId: id("passage"), tone: z.enum(["note", "warning", "question", "example"]) }), MediaFigureSchema, ExternalEmbedSchema, RichLinkBlockSchema,
  BlockBase.extend({ type: z.literal("diagram"), diagramId: id("diagram"), description: text }),
  BlockBase.extend({ type: z.literal("legacyMarkup"), locked: z.literal(true), sanitizedHtml: z.string().min(1), importedFrom: text }),
]);
export type ChapterBlock = z.infer<typeof ChapterBlockSchema>;

export const CheckpointReferenceNodeSchema = z.object({ type: z.literal("checkpointRef"), checkpointId: id("checkpoint") }).strict();
export const PlacementReferenceNodeSchema = z.object({ type: z.literal("placementRef"), placementId: id("placement") }).strict();
export const ChapterFlowNodeSchema = z.union([ChapterBlockSchema, CheckpointReferenceNodeSchema, PlacementReferenceNodeSchema]);
export type CheckpointReferenceNode = z.infer<typeof CheckpointReferenceNodeSchema>;
export type PlacementReferenceNode = z.infer<typeof PlacementReferenceNodeSchema>;
export type ChapterFlowNode = z.infer<typeof ChapterFlowNodeSchema>;

export const PromptCheckpointV2Schema = z.object({
  checkpointId: id("checkpoint"), legacyId: text.optional(), passageId: id("passage"), passageExcerptHash: sha256, displayOrder: z.number().int().nonnegative(), slotLabel: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/).optional(), stage: text.max(120).optional(),
  strategy: z.enum(["initial-judgment", "self-explanation", "argument-reconstruction", "evidence-warrant", "contrast-case", "counterexample", "consider-alternative", "objection-repair", "question-generation", "epistemic-calibration", "framework-comparison", "transfer", "metacognitive-trace"]), title: text, trigger: text, prompt: text, guidance: text, responseStructure: z.enum(["prose", "movement-plus-prose"]), minWords: z.number().int().min(1).max(1_000), maxWords: z.number().int().min(1).max(1_000), showInSidebar: z.boolean(), rationale: text, editorialApprovalId: id("approval").optional(),
}).strict().superRefine((value, ctx) => { if (value.minWords > value.maxWords) ctx.addIssue({ code: "custom", path: ["minWords"], message: "Minimum words cannot exceed maximum words" }); });
export const PromptCheckpointV3Schema = z.object({
  checkpointId: id("checkpoint"), legacyId: text.optional(), passageId: id("passage"), passageExcerptHash: sha256, slotLabel: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/).optional(), stage: text.max(120).optional(),
  strategy: z.enum(["initial-judgment", "self-explanation", "argument-reconstruction", "evidence-warrant", "contrast-case", "counterexample", "consider-alternative", "objection-repair", "question-generation", "epistemic-calibration", "framework-comparison", "transfer", "metacognitive-trace"]), title: text, trigger: text, prompt: text, guidance: text, responseStructure: z.enum(["prose", "movement-plus-prose"]), minWords: z.number().int().min(1).max(1_000), maxWords: z.number().int().min(1).max(1_000), showInSidebar: z.boolean(), rationale: text, editorialApprovalId: id("approval").optional(),
}).strict().superRefine((value, ctx) => { if (value.minWords > value.maxWords) ctx.addIssue({ code: "custom", path: ["minWords"], message: "Minimum words cannot exceed maximum words" }); });
export const PromptCheckpointSchema = z.union([PromptCheckpointV2Schema, PromptCheckpointV3Schema]);
const Reference = z.object({ referenceId: id("reference"), label: text, url: https.optional() }).strict();
const personId = z.string().regex(/^[a-z][a-z0-9-]{0,119}$/);
export const ChapterPersonRelationSchema = z.object({ personId, role: text, passageIds: z.array(id("passage")).max(100) }).strict();
export type ChapterPersonRelation = z.infer<typeof ChapterPersonRelationSchema>;
export const EntityRevisionSchema = z.object({ entityRevisionId: id("revision"), personId, sha256, sourcePath: relativePath }).strict();
export const PersonFeatureProjectionSchema = z.object({
  // `personFeatureId` is the immutable managed-content key. `placementId` is retained
  // in the frozen renderer projection so the projected card cannot be duplicated.
  personFeatureId: id("personfeature").optional(), placementId: id("placement"), personId, entityRevisionId: id("revision"), name: text.max(300), dates: text.max(120), role: text, teachingNote: text, biography: text,
  primarySources: z.array(z.object({ sourceId: text, title: text, creator: text, locator: text.optional(), translation: text.optional(), excerpt: text.optional(), teachingUse: text, label: text, url: https.optional() }).strict()),
  portrait: z.object({ mediaVersionId, src: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive(), alt: text, credit: text, title: text, creator: text.optional(), derivativeModification: text.optional(), license: text, licenseUrl: url.optional(), sourceUrl: https.optional(), commonsPageUrl: https.optional(), reviewedSourceRevision: z.string().min(1).optional() }).strict(),
  displayPreset: z.literal("thinker-card"),
}).strict();
export type PersonFeatureProjection = z.infer<typeof PersonFeatureProjectionSchema>;
export const ManagedPlacementV2Schema = z.object({
  placementId: id("placement"), kind: z.enum(["personFeature", "media", "embed", "diagram", "artifact"]), contentId: z.string().min(1), anchorPassageId: id("passage"), position: z.enum(["before", "after"]), orderAtAnchor: z.number().int().nonnegative(), displayPreset: z.enum(["thinker-card", "narrow", "reading", "wide", "bleed", "compact"]),
}).strict().superRefine((value, ctx) => {
  if (value.kind === "personFeature" && value.displayPreset !== "thinker-card") ctx.addIssue({ code: "custom", path: ["displayPreset"], message: "Person features require the thinker-card preset" });
});
export const ManagedPlacementV3Schema = z.object({
  placementId: id("placement"), kind: z.literal("personFeature"), contentId: id("personfeature"), anchorPassageId: id("passage"), displayPreset: z.literal("thinker-card"),
}).strict();
export const ManagedPlacementSchema = z.union([ManagedPlacementV2Schema, ManagedPlacementV3Schema]);
export type ManagedPlacement = z.infer<typeof ManagedPlacementSchema>;
const ChapterCommonShape = {
  chapterId: id("chapter"), contentKey: text, slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: text, subtitle: text.optional(), description: text, part: PartReferenceSchema, order: z.number().int().positive(), chapterVersion: text, revisionId: id("revision"), reasoningObjective: text, readingRecordLicense: z.literal("CC0-1.0"), sidePanelModules: z.array(z.object({ moduleId: id("module"), type: z.enum(["readingRecord", "sources", "glossary"]), order: z.number().int().nonnegative() }).strict()), annotations: z.array(z.object({ annotationId: id("annotation"), passageId: id("passage"), body: text }).strict()), sources: z.array(Reference), people: z.array(ChapterPersonRelationSchema), entityRevisions: z.array(EntityRevisionSchema).default([]), personFeatures: z.array(PersonFeatureProjectionSchema).default([]), concepts: z.array(z.object({ entityId: text, relation: text }).strict()), traditions: z.array(z.object({ entityId: text, relation: text }).strict()), worldLayer: z.object({ worldLayerId: id("world"), version: text }).strict(), diagrams: z.array(z.object({ diagramId: id("diagram"), title: text }).strict()), mediaPlacementIds: z.array(id("figure")), rightsCaseIds: z.array(rightsCaseId), licenses: z.object({ chapter: text, assets: z.array(text) }).strict(), exports: z.object({ web: z.boolean(), print: z.boolean(), offline: z.boolean(), voice: z.boolean() }).strict(), aliases: z.array(IdentityAliasSchema), tombstones: z.array(IdentityTombstoneSchema), updatedBy: ActorReferenceSchema, updatedAt: time,
};
const ChapterBaseV2Schema = z.object({ schemaVersion: z.literal(LEGACY_CONTENT_SCHEMA_VERSION), ...ChapterCommonShape, body: z.array(ChapterBlockSchema), managedPlacements: z.array(ManagedPlacementV2Schema).default([]) }).strict();
const ChapterBaseV3Schema = z.object({ schemaVersion: z.literal(CONTENT_SCHEMA_VERSION), ...ChapterCommonShape, body: z.array(ChapterFlowNodeSchema), managedPlacements: z.array(ManagedPlacementV3Schema).default([]) }).strict();
type ChapterForValidation = (z.infer<typeof ChapterBaseV2Schema> | z.infer<typeof ChapterBaseV3Schema>) & { checkpoints: Array<{ checkpointId: string; passageId: string }> };
const validateChapterReferences = (v: ChapterForValidation, ctx: z.RefinementCtx) => {
  if (new Set(v.checkpoints.map((p) => p.checkpointId)).size !== v.checkpoints.length) ctx.addIssue({ code: "custom", path: ["checkpoints"], message: "Checkpoint IDs must be unique" });
  const passages = new Set(v.body.flatMap((block) => [block.anchorPassageId, "passageId" in block ? block.passageId : undefined]).filter((value): value is string => Boolean(value)));
  const replacements = new Map(v.tombstones.filter((item) => item.id.startsWith("passage_") && item.replacementId).map((item) => [item.id, item.replacementId!]));
  const resolvesAnchor = (anchor: string) => passages.has(anchor) || (replacements.has(anchor) && passages.has(replacements.get(anchor)!));
  for (const [index, checkpoint] of v.checkpoints.entries()) if (!resolvesAnchor(checkpoint.passageId)) ctx.addIssue({ code: "custom", path: ["checkpoints", index, "passageId"], message: "Checkpoint context passage must resolve to a chapter anchor" });
  for (const [index, relation] of v.people.entries()) for (const anchor of relation.passageIds) if (!resolvesAnchor(anchor)) ctx.addIssue({ code: "custom", path: ["people", index, "passageIds"], message: "Person relation passage must resolve to a chapter anchor" });
  const relationPeople = new Set(v.people.map((relation) => relation.personId));
  const revisions = new Map(v.entityRevisions.map((revision) => [revision.entityRevisionId, revision]));
  const features = new Map(v.personFeatures.map((feature) => [feature.personFeatureId ?? feature.placementId, feature]));
  const placementIds = new Set<string>(); const placementPositions = new Set<string>();
  for (const [index, placement] of v.managedPlacements.entries()) {
    if (placementIds.has(placement.placementId)) ctx.addIssue({ code: "custom", path: ["managedPlacements", index, "placementId"], message: "Placement IDs must be unique within a chapter" });
    placementIds.add(placement.placementId);
    if (v.schemaVersion === 2) {
      const legacyPlacement = placement as z.infer<typeof ManagedPlacementV2Schema>;
      const positionKey = `${legacyPlacement.anchorPassageId}:${legacyPlacement.position}:${legacyPlacement.orderAtAnchor}`;
      if (placementPositions.has(positionKey)) ctx.addIssue({ code: "custom", path: ["managedPlacements", index, "orderAtAnchor"], message: "Placement order must be unique at an anchor and position" });
      placementPositions.add(positionKey);
    }
    if (!resolvesAnchor(placement.anchorPassageId)) ctx.addIssue({ code: "custom", path: ["managedPlacements", index, "anchorPassageId"], message: "Managed placement anchor must resolve to a chapter anchor" });
    if (placement.kind === "personFeature") {
      const feature = features.get(placement.contentId);
      if (!feature) ctx.addIssue({ code: "custom", path: ["managedPlacements", index, "contentId"], message: "Person feature placement must reference a frozen person feature" });
      else if (feature.placementId !== placement.placementId) ctx.addIssue({ code: "custom", path: ["managedPlacements", index, "contentId"], message: "Person feature placement must match its frozen projection" });
    }
  }
  for (const [index, feature] of v.personFeatures.entries()) {
    if (!relationPeople.has(feature.personId)) ctx.addIssue({ code: "custom", path: ["personFeatures", index, "personId"], message: "Person feature must reference a chapter person relation" });
    const revision = revisions.get(feature.entityRevisionId);
    if (!revision || revision.personId !== feature.personId) ctx.addIssue({ code: "custom", path: ["personFeatures", index, "entityRevisionId"], message: "Person feature must reference a frozen revision for the same person" });
    if (!placementIds.has(feature.placementId)) ctx.addIssue({ code: "custom", path: ["personFeatures", index, "placementId"], message: "Person feature projection must have one managed placement" });
  }
  if (v.schemaVersion === 3) {
    const checkpointTargets = new Map(v.checkpoints.map((item) => [item.checkpointId, 0]));
    const placementTargets = new Map(v.managedPlacements.map((item) => [item.placementId, 0]));
    v.body.forEach((node, index) => {
      if (node.type === "checkpointRef") {
        if (!checkpointTargets.has(node.checkpointId)) ctx.addIssue({ code: "custom", path: ["body", index, "checkpointId"], message: "Checkpoint reference must resolve to one checkpoint record" });
        else checkpointTargets.set(node.checkpointId, checkpointTargets.get(node.checkpointId)! + 1);
      }
      if (node.type === "placementRef") {
        if (!placementTargets.has(node.placementId)) ctx.addIssue({ code: "custom", path: ["body", index, "placementId"], message: "Placement reference must resolve to one managed placement record" });
        else placementTargets.set(node.placementId, placementTargets.get(node.placementId)! + 1);
      }
    });
    for (const [checkpointId, count] of checkpointTargets) if (count !== 1) ctx.addIssue({ code: "custom", path: ["body"], message: `Checkpoint ${checkpointId} must appear exactly once in chapter flow` });
    for (const [placementId, count] of placementTargets) if (count !== 1) ctx.addIssue({ code: "custom", path: ["body"], message: `Placement ${placementId} must appear exactly once in chapter flow` });
  }
};
const DraftChapterBundleV2Schema = ChapterBaseV2Schema.extend({ status: z.enum(["draft", "inReview"]), checkpoints: z.array(PromptCheckpointV2Schema) }).superRefine(validateChapterReferences);
const DraftChapterBundleV3Schema = ChapterBaseV3Schema.extend({ status: z.enum(["draft", "inReview"]), checkpoints: z.array(PromptCheckpointV3Schema) }).superRefine(validateChapterReferences);
const PublishableChapterBundleV2Schema = ChapterBaseV2Schema.extend({ status: z.enum(["approved", "published"]), checkpoints: z.array(PromptCheckpointV2Schema) }).superRefine(validateChapterReferences);
const PublishableChapterBundleV3Schema = ChapterBaseV3Schema.extend({ status: z.enum(["approved", "published"]), checkpoints: z.array(PromptCheckpointV3Schema) }).superRefine(validateChapterReferences);
export const DraftChapterBundleSchema = z.union([DraftChapterBundleV2Schema, DraftChapterBundleV3Schema]);
export const PublishableChapterBundleSchema = z.union([PublishableChapterBundleV2Schema, PublishableChapterBundleV3Schema]);
export const ChapterBundleSchema = z.union([DraftChapterBundleSchema, PublishableChapterBundleSchema]);
export type DraftChapterBundle = z.infer<typeof DraftChapterBundleSchema>; export type PublishableChapterBundle = z.infer<typeof PublishableChapterBundleSchema>; export type ChapterBundle = z.infer<typeof ChapterBundleSchema>;

export const MediaAssetSchema = z.object({ mediaId: id("media"), title: text, versionIds: z.array(mediaVersionId).min(1) }).strict();
export const MediaAssetVersionSchema = z.object({ mediaVersionId, mediaId: id("media"), kind: z.enum(["image", "animatedImage", "shortVideo", "audio", "document"]), sourceAssetRef: text, posterAssetRef: text.optional(), derivatives: z.array(z.object({ assetRef: text, kind: text, sha256 }).strict()), technical: z.object({ mimeType: text, bytes: z.number().int().nonnegative(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), frameCount: z.number().int().positive().optional(), durationMs: z.number().int().positive().optional(), sha256 }).strict(), accessibility: z.object({ longDescription: text.optional(), transcript: text.optional(), captionTrackRef: text.optional(), motionReview: z.enum(["passed", "reviewRequired"]).optional(), flashReview: z.enum(["passed", "reviewRequired"]).optional() }).strict(), processing: z.object({ status: z.enum(["created", "uploading", "quarantined", "processing", "ready", "failed"]), processorVersion: text, errorCode: text.optional() }).strict(), createdAt: time, createdBy: ActorReferenceSchema }).strict();
export const RightsClearanceSchema = z.discriminatedUnion("basis", [
  z.object({ basis: z.literal("humanApproval") }).strict(),
  z.object({ basis: z.literal("policy"), policyVersion: text, evidenceReceiptId: id("receipt") }).strict(),
]);
export const RightsCaseSchema = z.object({ rightsCaseId, subject: z.object({ mediaVersionId, sourceRevision: text.optional(), transformationsHash: sha256, placementId: id("figure").optional(), projections: z.array(z.enum(["web", "print", "offline", "download", "voice"])).min(1), downloadable: z.boolean() }).strict(), creator: text.optional(), sourceUrl: https.optional(), license: z.enum(["cc0", "publicDomain", "ccBy", "ccBySa", "fairUse", "permission", "owned", "unknown"]), licenseUrl: https.optional(), attribution: text, evidenceRefs: z.array(Reference), notes: text.optional(), status: z.enum(["reviewRequired", "cleared", "blocked"]), clearance: RightsClearanceSchema.optional(), approvedBy: ActorReferenceSchema.optional(), approvedAt: time.optional(), approvedSubjectHash: sha256.optional() }).strict().superRefine((value, ctx) => {
  if (value.status === "cleared" && !value.clearance) ctx.addIssue({ code: "custom", path: ["clearance"], message: "Cleared rights cases require typed clearance evidence" });
  if (value.status !== "cleared" && value.clearance) ctx.addIssue({ code: "custom", path: ["clearance"], message: "Only cleared rights cases may carry clearance evidence" });
  if (value.clearance?.basis === "humanApproval" && (!value.approvedBy || !value.approvedAt || !value.approvedSubjectHash)) ctx.addIssue({ code: "custom", path: ["clearance"], message: "Human clearance requires approvedBy, approvedAt, and approvedSubjectHash" });
});
export const EditorialApprovalSchema = z.object({ approvalId: id("approval"), subjectType: z.enum(["checkpoint", "mediaPlacement", "chapterRevision", "releaseCandidate"]), subjectId: text, subjectHash: sha256, approvedBy: ActorReferenceSchema, approvedAt: time, notes: text.optional() }).strict();

export const ReleaseMediaProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  assets: z.array(z.object({ sha256, bytes: z.number().int().positive().max(100 * 1024 * 1024), mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "audio/mpeg", "audio/wav", "audio/mp4", "video/mp4", "video/webm", "application/pdf", "text/plain"]), mediaId: id("media"), mediaVersionId, rightsCaseId, role: z.enum(["derivative", "poster", "responsive-640", "responsive-1280", "responsive-1920"]), objectKey: relativePath, downloadPath: z.string().regex(/^\/v1\/release-assets\/[a-f0-9]{64}$/) }).strict()).max(256),
  versions: z.array(z.object({ mediaId: id("media"), mediaVersionId, title: text, kind: z.enum(["image", "gif", "audio", "video", "pdf", "document"]), source: z.object({ sha256, bytes: z.number().int().positive(), mimeType: text, immutableAddress: text }).strict(), rights: z.object({ rightsCaseId, status: z.literal("cleared"), reviewId: text, reviewPackageId: id("reviewpkg"), declarationHash: sha256, credit: text.nullable() }).strict(), technical: z.record(z.unknown()), transcriptEquivalent: z.object({ language: text.max(40), text: transcriptText, kind: text.optional() }).strict().nullable(), assetSha256s: z.array(sha256).min(1) }).strict()).max(100),
  placements: z.array(z.object({ figureId: id("figure"), mediaId: id("media"), mediaVersionId, rightsCaseId, kind: z.enum(["image", "gif", "audio", "video", "pdf", "document"]), derivativeSha256: sha256, posterSha256: sha256.nullable(), credit: text.nullable(), transcriptEquivalent: z.object({ language: text.max(40), text: transcriptText, kind: text.optional() }).strict().nullable(), downloadable: z.boolean() }).strict()).max(100),
}).strict();

export const ContentSourceDescriptorSchema = z.discriminatedUnion("authority", [
  z.object({ authority: z.literal("git"), gitSha: sha256, sourcePath: relativePath, normalizedSnapshotHash: sha256 }).strict(),
  z.object({ authority: z.literal("d1"), documentId: text, domainRevisionId: id("revision"), normalizedSnapshotHash: sha256 }).strict(),
]);
const ContentObject = z.object({ type: z.enum(["book", "chapter", "media", "rights", "annotation", "source", "person", "concept", "tradition", "world", "diagram"]), domainRevisionId: id("revision"), sha256 }).strict();
export const BookReleaseSnapshotSchema = z.object({ schemaVersion: z.union([z.literal(LEGACY_CONTENT_SCHEMA_VERSION), z.literal(CONTENT_SCHEMA_VERSION)]), book: z.object({ bookId: id("book"), title: text, version: text }).strict(), parts: z.array(PartReferenceSchema), chapters: z.array(PublishableChapterBundleSchema), contentObjects: z.record(ContentObject), authorityRegistry: z.record(ContentSourceDescriptorSchema), mediaProjection: ReleaseMediaProjectionSchema.optional() }).strict();
export type BookReleaseSnapshot = z.infer<typeof BookReleaseSnapshotSchema>;

export const SemanticOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("replaceText"), operationId: id("op"), blockId: id("block"), text }).strict(), z.object({ kind: z.literal("replaceChapterBody"), operationId: id("op"), body: z.array(ChapterBlockSchema).min(1).max(2_000) }).strict(), z.object({ kind: z.literal("replaceChapterDocumentV3"), operationId: id("op"), document: z.record(z.unknown()) }).strict(), z.object({ kind: z.literal("insertBlock"), operationId: id("op"), afterBlockId: id("block").optional(), block: ChapterBlockSchema }).strict(), z.object({ kind: z.literal("splitBlock"), operationId: id("op"), blockId: id("block"), offset: z.number().int().nonnegative() }).strict(), z.object({ kind: z.literal("joinBlocks"), operationId: id("op"), firstBlockId: id("block"), secondBlockId: id("block") }).strict(), z.object({ kind: z.literal("moveBlock"), operationId: id("op"), blockId: id("block"), afterBlockId: id("block").optional() }).strict(), z.object({ kind: z.literal("removeBlock"), operationId: id("op"), blockId: id("block"), replacementPassageId: id("passage").optional() }).strict(), z.object({ kind: z.literal("retireAnchor"), operationId: id("op"), passageId: id("passage"), replacementPassageId: id("passage").optional(), reason: text }).strict(), z.object({ kind: z.literal("upsertCheckpoint"), operationId: id("op"), checkpoint: PromptCheckpointSchema }).strict(), z.object({ kind: z.literal("moveCheckpoint"), operationId: id("op"), checkpointId: id("checkpoint"), beforeNodeId: text.optional(), afterNodeId: text.optional(), passageId: id("passage").optional() }).strict(), z.object({ kind: z.literal("removeCheckpoint"), operationId: id("op"), checkpointId: id("checkpoint") }).strict(), z.object({ kind: z.literal("moveManagedPlacement"), operationId: id("op"), placementId: id("placement"), beforeNodeId: text.optional(), afterNodeId: text.optional() }).strict(), z.object({ kind: z.literal("placeMedia"), operationId: id("op"), figure: MediaFigureSchema }).strict(), z.object({ kind: z.literal("upsertEmbed"), operationId: id("op"), embed: ExternalEmbedSchema.or(RichLinkBlockSchema) }).strict(),
]);
export const OperationEnvelopeSchema = z.object({ operationId: id("op"), idempotencyKey: z.string().uuid(), changeSetId: id("changeset"), expectedBaseRevisionId: id("revision"), actor: ActorReferenceSchema, runId: id("run").optional(), submittedAt: time, operation: SemanticOperationSchema }).strict().superRefine((v, ctx) => { if (v.operation.operationId !== v.operationId) ctx.addIssue({ code: "custom", path: ["operation", "operationId"], message: "Operation ID must equal envelope ID" }); });
export const ChangeSetSchema = z.object({ changeSetId: id("changeset"), targets: z.array(z.object({ documentId: text, documentType: ContentObject.shape.type, baseDomainRevisionId: id("revision"), baseHeadRevisionId: id("revision"), workingDocumentId: text }).strict()).min(1), state: z.enum(["draft", "inReview", "approved", "merged", "rejected", "superseded"]), operations: z.array(SemanticOperationSchema), actor: ActorReferenceSchema, runId: id("run").optional(), createdAt: time, updatedAt: time, beforeSnapshot: z.object({ uri: text, sha256 }).strict(), workingSnapshot: z.object({ uri: text, sha256 }).strict(), submittedSnapshot: z.object({ uri: text, sha256 }).strict().optional(), validationSummary: z.object({ valid: z.boolean(), errors: z.array(text), warnings: z.array(text) }).strict(), reviewNotes: z.array(z.object({ author: ActorReferenceSchema, body: text, createdAt: time }).strict()), contentApprovalIds: z.array(id("approval")), rightsApprovalIds: z.array(id("approval")) }).strict();
const CodeProvenance = z.object({ gitSha: sha256, protectedRef: text, lockfileSha256: sha256, nodeVersion: text, buildImageDigest: text, contractVersion: z.literal(CONTENT_CONTRACT_VERSION) }).strict();
export const ReleaseCandidateManifestSchema = z.object({ candidateId: id("candidate"), sequence: z.number().int().positive(), createdAt: time, createdBy: ActorReferenceSchema, expectedActiveReleaseId: id("release").nullable(), contractVersion: z.literal(CONTENT_CONTRACT_VERSION), authorityRegistry: z.record(ContentSourceDescriptorSchema), snapshot: z.object({ uri: text, sha256, bytes: z.number().int().nonnegative() }).strict(), contentObjects: z.record(ContentObject), sourceAssets: z.record(z.discriminatedUnion("storage", [z.object({ storage: z.literal("git"), gitSha: sha256, sourcePath: relativePath, sha256 }).strict(), z.object({ storage: z.literal("r2"), objectKey: text, mediaVersionId, sha256 }).strict()])), approvalIds: z.array(id("approval")), codeProvenance: CodeProvenance, manifestSha256: sha256, signature: text }).strict();
export const BuildAttestationSchema = z.object({ attestationId: id("attestation"), candidateId: id("candidate"), candidateManifestSha256: sha256, checks: z.array(z.object({ name: text, passed: z.boolean(), detail: text.optional() }).strict()), embedHealthObservations: z.array(id("observation")), releaseAssets: z.record(z.object({ releaseUrl: https, sha256 }).strict()), artifact: z.object({ uri: text, sha256, bytes: z.number().int().nonnegative() }).strict(), cloudflareVersionId: text, previewUrl: https, builtAt: time, signature: text }).strict();
export const DeploymentReceiptSchema = z.object({ receiptId: id("receipt"), candidateId: id("candidate"), attestationId: id("attestation"), previousActiveReleaseId: id("release").nullable(), expectedActiveReleaseId: id("release").nullable(), cloudflareDeploymentId: text, cloudflareVersionId: text, promotedAt: time, promotedBy: ActorReferenceSchema, verificationHash: sha256 }).strict();
export const ActiveReleasePointerSchema = z.object({ releaseId: id("release"), candidateId: id("candidate"), attestationId: id("attestation"), deploymentReceiptId: id("receipt"), sequence: z.number().int().positive() }).strict();

export const jsonSchemas = { chapterBundle: zodToJsonSchema(ChapterBundleSchema, { name: "ChapterBundle", $refStrategy: "none" }), bookReleaseSnapshot: zodToJsonSchema(BookReleaseSnapshotSchema, { name: "BookReleaseSnapshot", $refStrategy: "none" }), operationEnvelope: zodToJsonSchema(OperationEnvelopeSchema, { name: "OperationEnvelope", $refStrategy: "none" }), changeSet: zodToJsonSchema(ChangeSetSchema, { name: "ChangeSet", $refStrategy: "none" }), releaseCandidateManifest: zodToJsonSchema(ReleaseCandidateManifestSchema, { name: "ReleaseCandidateManifest", $refStrategy: "none" }) };
export const parseChapterBundle = (input: unknown): ChapterBundle => ChapterBundleSchema.parse(input);
