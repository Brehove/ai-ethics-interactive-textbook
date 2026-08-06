import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DraftChapterBundleSchema, PublishableChapterBundleSchema, ExternalEmbedSchema, OperationEnvelopeSchema, ContentSourceDescriptorSchema, ReleaseMediaProjectionSchema, RightsCaseSchema, jsonSchemas } from "../../packages/content-contract/src/index.ts";

const hash = "a".repeat(64); const actor = { actorId: "actor_joel", actorType: "human" as const };
const base = { schemaVersion: 2 as const, chapterId: "chapter_01", contentKey: "ch01", slug: "a-chapter", title: "A Chapter", description: "A description", part: { partId: "part_01", title: "Part I", order: 1 }, order: 1, chapterVersion: "1.0", revisionId: "revision_01", body: [{ type: "heading" as const, blockId: "block_heading", sectionId: "section_01", level: 2, text: "Start" }, { type: "paragraph" as const, blockId: "block_paragraph", passageId: "passage_01", text: "Argument." }], reasoningObjective: "Evaluate an argument.", readingRecordLicense: "CC0-1.0" as const, sidePanelModules: [{ moduleId: "module_reading", type: "readingRecord" as const, order: 0 }], annotations: [], sources: [], people: [], concepts: [], traditions: [], worldLayer: { worldLayerId: "world_01", version: "1" }, diagrams: [], mediaPlacementIds: [], rightsCaseIds: [], licenses: { chapter: "CC-BY-4.0", assets: [] }, exports: { web: true, print: true, offline: true, voice: true }, aliases: [], tombstones: [], updatedBy: actor, updatedAt: "2026-08-02T12:00:00.000Z" };
const checkpoint = (slotLabel: string, n: string, displayOrder = 0) => ({ checkpointId: `checkpoint_${n}`, passageId: "passage_01", passageExcerptHash: hash, displayOrder, slotLabel, stage: slotLabel, strategy: "initial-judgment" as const, title: slotLabel, trigger: "Pause.", prompt: "Respond.", guidance: "Be concrete.", responseStructure: "prose" as const, minWords: 30, maxWords: 250, showInSidebar: true, rationale: "Practice judgment." });
const personFeatureChapter = () => ({ ...base, people: [{ personId: "aristotle", role: "virtue ethics guide", passageIds: ["passage_01"] }], entityRevisions: [{ entityRevisionId: "revision_aristotle", personId: "aristotle", sha256: hash, sourcePath: "content/entities/people/records/aristotle.json" }], personFeatures: [{ personFeatureId: "personfeature_aristotle", placementId: "placement_aristotle", personId: "aristotle", entityRevisionId: "revision_aristotle", name: "Aristotle", dates: "384–322 BCE", role: "virtue ethics guide", teachingNote: "Practice judgment.", biography: "A frozen biography.", primarySources: [], portrait: { mediaVersionId: "mediaVersion_aristotle", src: "/media/aristotle.webp", width: 720, height: 900, alt: "A portrait of Aristotle.", credit: "Public domain.", title: "Aristotle portrait", license: "Public domain", commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Aristotle.jpg", reviewedSourceRevision: "123" }, displayPreset: "thinker-card" }], managedPlacements: [{ placementId: "placement_aristotle", kind: "personFeature" as const, contentId: "personfeature_aristotle", anchorPassageId: "passage_01", position: "after" as const, orderAtAnchor: 0, displayPreset: "thinker-card" }] });

test("draft accepts zero or many checkpoints with repeated pedagogical labels and unique IDs", () => { assert.equal(DraftChapterBundleSchema.safeParse({ ...base, status: "draft", checkpoints: [] }).success, true); assert.equal(DraftChapterBundleSchema.safeParse({ ...base, status: "draft", checkpoints: [checkpoint("reflect", "1", 0), checkpoint("reflect", "2", 1), checkpoint("reflect", "3", 2), checkpoint("reflect", "4", 3)] }).success, true); assert.equal(DraftChapterBundleSchema.safeParse({ ...base, status: "draft", checkpoints: [checkpoint("reflect", "1"), checkpoint("reflect", "1", 1)] }).success, false); });
test("publication accepts any checkpoint count, shared passage anchors, and display ordering", () => { const result = PublishableChapterBundleSchema.safeParse({ ...base, status: "approved", checkpoints: [checkpoint("reflect", "1", 2), checkpoint("reflect", "2", 0), checkpoint("reflect", "3", 1), checkpoint("reflect", "4", 3)] }); assert.equal(result.success, true); if (result.success) assert.deepEqual(result.data.checkpoints.map((item) => item.displayOrder), [2, 0, 1, 3]); });
test("schema v3 makes reference order authoritative and rejects v2-v3 hybrids", () => {
  const { displayOrder: _displayOrder, ...record } = checkpoint("reflect", "v3");
  const v3 = { ...base, schemaVersion: 3 as const, status: "approved" as const, body: [...base.body, { type: "checkpointRef" as const, checkpointId: record.checkpointId }], checkpoints: [record] };
  assert.equal(PublishableChapterBundleSchema.safeParse(v3).success, true);
  assert.equal(PublishableChapterBundleSchema.safeParse({ ...v3, body: [...v3.body, { type: "checkpointRef", checkpointId: record.checkpointId }] }).success, false);
  assert.equal(PublishableChapterBundleSchema.safeParse({ ...v3, body: base.body }).success, false);
  assert.equal(PublishableChapterBundleSchema.safeParse({ ...v3, checkpoints: [{ ...record, displayOrder: 0 }] }).success, false);
  assert.equal(PublishableChapterBundleSchema.safeParse({ ...base, status: "approved", body: [...base.body, { type: "checkpointRef", checkpointId: "checkpoint_v3" }], checkpoints: [checkpoint("reflect", "v3")] }).success, false);
});
test("schema v3 reserves placement references for separately stored person features", () => {
  const chapter = personFeatureChapter();
  const { position: _position, orderAtAnchor: _orderAtAnchor, ...placement } = chapter.managedPlacements[0];
  const v3 = { ...chapter, schemaVersion: 3 as const, status: "approved" as const, body: [...chapter.body, { type: "placementRef" as const, placementId: placement.placementId }], checkpoints: [], managedPlacements: [placement] };
  assert.equal(PublishableChapterBundleSchema.safeParse(v3).success, true);
  assert.equal(PublishableChapterBundleSchema.safeParse({ ...v3, managedPlacements: [{ ...placement, kind: "media", contentId: "media_01", displayPreset: "reading" }] }).success, false);
});
test("schema v4 requires normalized card presentation and validates contiguous non-overlapping regions", () => {
  const card = (n: string) => ({ type: "artifactCard" as const, blockId: `block_card_${n}`, artifactId: `artifact_${n}`, title: `Card ${n}`, summary: "A bounded artifact.", teachingUse: "Compare the cases.", presentation: { width: "medium" as const, align: "center" as const, density: "standard" as const } });
  const cards = [card("one"), card("two")];
  const v4 = { ...base, schemaVersion: 4 as const, layoutCatalogVersion: "2026-08-05" as const, status: "draft" as const, body: [...base.body, ...cards], checkpoints: [], managedPlacements: [], personFeatures: [], layoutRegions: [{ layoutId: "layout_pair", type: "card-grid" as const, startNodeId: cards[0].blockId, endNodeId: cards[1].blockId, cardNodeIds: cards.map((item) => item.blockId), columns: 2, emphasis: "equal" as const }] };
  assert.equal(DraftChapterBundleSchema.safeParse(v4).success, true);
  assert.equal(DraftChapterBundleSchema.safeParse({ ...v4, body: [...base.body, { ...cards[0], presentation: undefined }, cards[1]] }).success, false);
  assert.equal(DraftChapterBundleSchema.safeParse({ ...v4, layoutRegions: [...v4.layoutRegions, { ...v4.layoutRegions[0], layoutId: "layout_overlap" }] }).success, false);
  const split = { ...v4, layoutRegions: [{ layoutId: "layout_split", type: "card-text-split" as const, startNodeId: "block_paragraph", endNodeId: cards[0].blockId, cardNodeIds: [cards[0].blockId], textNodeIds: ["block_paragraph"], cardSide: "end" as const, ratio: "card-narrow" as const }] };
  assert.equal(DraftChapterBundleSchema.safeParse(split).success, true);
  assert.equal(DraftChapterBundleSchema.safeParse({ ...split, layoutRegions: [{ ...split.layoutRegions[0], textNodeIds: [] }] }).success, false);
});
test("checkpoint side-panel and word-bound controls are validated", () => { assert.equal(DraftChapterBundleSchema.safeParse({ ...base, status: "draft", checkpoints: [{ ...checkpoint("commit", "1"), minWords: 300, maxWords: 250 }] }).success, false); assert.equal(DraftChapterBundleSchema.safeParse({ ...base, status: "draft", checkpoints: [{ ...checkpoint("commit", "1"), showInSidebar: false }] }).success, true); });
test("optional checkpoint labels are nonempty and no longer than 120 characters", () => { assert.equal(DraftChapterBundleSchema.safeParse({ ...base, status: "draft", checkpoints: [{ ...checkpoint("commit", "1"), stage: "" }] }).success, false); assert.equal(DraftChapterBundleSchema.safeParse({ ...base, status: "draft", checkpoints: [{ ...checkpoint("commit", "1"), stage: "x".repeat(121) }] }).success, false); assert.equal(DraftChapterBundleSchema.safeParse({ ...base, status: "draft", checkpoints: [{ ...checkpoint("commit", "1"), stage: undefined }] }).success, true); });
test("person features require frozen person revisions, a relation, and one managed placement", () => {
  const chapter = personFeatureChapter();
  assert.equal(DraftChapterBundleSchema.safeParse({ ...chapter, status: "draft", checkpoints: [] }).success, true);
  assert.equal(DraftChapterBundleSchema.safeParse({ ...chapter, status: "draft", checkpoints: [], entityRevisions: [] }).success, false);
  assert.equal(DraftChapterBundleSchema.safeParse({ ...chapter, status: "draft", checkpoints: [], managedPlacements: [] }).success, false);
  assert.equal(DraftChapterBundleSchema.safeParse({ ...chapter, status: "draft", checkpoints: [], managedPlacements: [...chapter.managedPlacements, { ...chapter.managedPlacements[0], placementId: "placement_second", contentId: "personfeature_aristotle", orderAtAnchor: 0 }] }).success, false);
});
test("managed placements reject orphan anchors and duplicate anchor position orders", () => {
  const chapter = personFeatureChapter();
  assert.equal(DraftChapterBundleSchema.safeParse({ ...chapter, status: "draft", checkpoints: [], managedPlacements: [{ ...chapter.managedPlacements[0], anchorPassageId: "passage_missing" }] }).success, false);
  assert.equal(DraftChapterBundleSchema.safeParse({ ...chapter, status: "draft", checkpoints: [], managedPlacements: [...chapter.managedPlacements, { placementId: "placement_other", kind: "media", contentId: "media_01", anchorPassageId: "passage_01", position: "after", orderAtAnchor: 0, displayPreset: "reading" }] }).success, false);
});
test("cleared rights retain the existing status vocabulary but require typed clearance evidence", () => {
  const cleared = { rightsCaseId: "rights_01", subject: { mediaVersionId: "mediaVersion_01", transformationsHash: hash, projections: ["web" as const], downloadable: false }, license: "publicDomain" as const, attribution: "Public domain.", evidenceRefs: [{ referenceId: "reference_01", label: "Commons record", url: "https://commons.wikimedia.org/wiki/File:Example.jpg" }], status: "cleared" as const, clearance: { basis: "policy" as const, policyVersion: "wikimedia-v1", evidenceReceiptId: "receipt_01" } };
  assert.equal(RightsCaseSchema.safeParse(cleared).success, true);
  assert.equal(RightsCaseSchema.safeParse({ ...cleared, clearance: undefined }).success, false);
  assert.equal(RightsCaseSchema.safeParse({ ...cleared, status: "reviewRequired", clearance: undefined }).success, true);
  assert.equal(RightsCaseSchema.safeParse({ ...cleared, clearance: { basis: "humanApproval" } }).success, false);
  assert.equal(RightsCaseSchema.safeParse({ ...cleared, clearance: { basis: "humanApproval" }, approvedBy: actor, approvedAt: "2026-08-02T12:00:00.000Z", approvedSubjectHash: hash }).success, true);
});
test("external embeds are typed and cannot carry raw markup", () => { const good = { type: "externalEmbed" as const, blockId: "block_embed", embedId: "embed_01", identity: { provider: "youtube" as const, resourceType: "video" as const, resourceId: "abc" }, canonicalUrl: "https://www.youtube.com/watch?v=abc", caption: "Video", teachingUse: "Compare arguments.", displayPreset: "reading" as const, theme: "auto" as const, options: { provider: "youtube" as const, captions: true }, fallback: { title: "Video", summary: "Summary", linkLabel: "Open", accessedAt: "2026-08-02T12:00:00.000Z" }, adapterVersion: "1" }; assert.equal(ExternalEmbedSchema.safeParse(good).success, true); assert.equal(ExternalEmbedSchema.safeParse({ ...good, options: { provider: "x", conversation: true } }).success, false); assert.equal(ExternalEmbedSchema.safeParse({ ...good, embedHtml: "<iframe>" }).success, false); });
test("extended providers remain typed and fallback-first", () => {
  const common = { type: "externalEmbed" as const, blockId: "block_embed", embedId: "embed_01", caption: "Media", teachingUse: "Compare the account.", displayPreset: "reading" as const, theme: "auto" as const, fallback: { title: "Media", summary: "Authored summary", linkLabel: "Open", accessedAt: "2026-08-02T12:00:00.000Z" }, adapterVersion: "1" };
  assert.equal(ExternalEmbedSchema.safeParse({ ...common, identity: { provider: "spotify", resourceType: "track", resourceId: "4uLU6hMCjMI75M1A2tKUQC" }, canonicalUrl: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", options: { provider: "spotify", explicitConsent: true } }).success, true);
  assert.equal(ExternalEmbedSchema.safeParse({ ...common, identity: { provider: "soundcloud", resourceType: "track", resourceId: "artist:track" }, canonicalUrl: "https://soundcloud.com/artist/track", options: { provider: "soundcloud", linkFirst: true } }).success, true);
  assert.equal(ExternalEmbedSchema.safeParse({ ...common, identity: { provider: "bluesky", resourceType: "post", resourceId: "abc123" }, canonicalUrl: "https://bsky.app/profile/example.bsky.social/post/abc123", options: { provider: "bluesky", linkFirst: true } }).success, true);
});
test("release media contract covers the complete bounded native upload set", () => {
  const make = (mimeType: "audio/wav" | "video/webm" | "text/plain", kind: "audio" | "video" | "document") => ({
    schemaVersion: 1 as const,
    assets: [{ sha256: hash, bytes: 12, mimeType, mediaId: "media_01", mediaVersionId: "mediaVersion_01", rightsCaseId: "rights_01", role: "derivative" as const, objectKey: `media/version/${kind}`, downloadPath: `/v1/release-assets/${hash}` }],
    versions: [{ mediaId: "media_01", mediaVersionId: "mediaVersion_01", title: "Accessible media", kind, source: { sha256: hash, bytes: 12, mimeType, immutableAddress: `sha256:${hash}` }, rights: { rightsCaseId: "rights_01", status: "cleared" as const, reviewId: "review_01", reviewPackageId: "reviewpkg_01", declarationHash: hash, credit: "Instructor" }, technical: {}, transcriptEquivalent: kind === "document" ? null : { language: "en", text: "Equivalent text." }, assetSha256s: [hash] }],
    placements: [{ figureId: "figure_01", mediaId: "media_01", mediaVersionId: "mediaVersion_01", rightsCaseId: "rights_01", kind, derivativeSha256: hash, posterSha256: null, credit: "Instructor", transcriptEquivalent: kind === "document" ? null : { language: "en", text: "Equivalent text." }, downloadable: true }]
  });
  assert.equal(ReleaseMediaProjectionSchema.safeParse(make("audio/wav", "audio")).success, true);
  assert.equal(ReleaseMediaProjectionSchema.safeParse(make("video/webm", "video")).success, true);
  assert.equal(ReleaseMediaProjectionSchema.safeParse(make("text/plain", "document")).success, true);
});
test("semantic envelopes bind operation ID, CAS revision, and idempotency", () => { const e = { operationId: "op_01", idempotencyKey: "a0d4b181-854e-4754-9ec3-5f9bc1da0933", changeSetId: "changeset_01", expectedBaseRevisionId: "revision_01", actor, submittedAt: "2026-08-02T12:00:00.000Z", operation: { kind: "replaceText" as const, operationId: "op_01", blockId: "block_paragraph", text: "Revised." } }; assert.equal(OperationEnvelopeSchema.safeParse(e).success, true); assert.equal(OperationEnvelopeSchema.safeParse({ ...e, operation: { ...e.operation, operationId: "op_no" } }).success, false); });
test("JSON schema is derived from release and command contracts", () => { assert.ok("definitions" in jsonSchemas.bookReleaseSnapshot); assert.ok("definitions" in jsonSchemas.operationEnvelope); });
test("content authority is explicitly Git or D1, never a vendor-specific direct-write path", () => {
  assert.equal(ContentSourceDescriptorSchema.safeParse({ authority: "d1", documentId: "chapter_01", domainRevisionId: "revision_01", normalizedSnapshotHash: hash }).success, true);
  assert.equal(ContentSourceDescriptorSchema.safeParse({ authority: "sanity", projectId: "project", dataset: "production", domainRevisionId: "revision_01", normalizedSnapshotHash: hash }).success, false);
});
test("frozen OpenAPI is valid JSON and exposes the complete agent and human boundary", () => {
  const spec = JSON.parse(readFileSync(new URL("../../packages/content-contract/openapi/content-api.v1.openapi.json", import.meta.url), "utf8"));
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(Object.keys(spec.paths).length >= 29, true);
  assert.equal(spec.paths["/v1/media-review-packages"].post["x-agent-safe"], true);
  assert.equal(spec.paths["/v1/media-review-packages/{reviewPackageId}"].get["x-human-only"], true);
  assert.equal(spec.paths["/v1/media-review-packages/{reviewPackageId}:decide"].post["x-human-only"], true);
  assert.equal(spec.paths["/v1/changesets/{changesetId}:approve"].post["x-human-only"], true);
  assert.equal(spec.paths["/v1/changesets/{changesetId}:publish"].post["x-human-only"], true);
  assert.equal(spec.paths["/v1/changesets/{changesetId}:publish"].post["x-enabled"], false);
  assert.equal(spec.paths["/v1/changesets"].post["x-atomic-working-copy"], true);
  assert.equal(spec.paths["/v1/changesets/{changesetId}:submitReview"].post["x-all-target-cas"], true);
  assert.equal(spec.paths["/v1/authority:activateD1"].post["x-exact-active-release-binding"], true);
  assert.equal(spec.paths["/v1/authority:activateD1"].post["x-database-guarded"], true);
  assert.equal(spec.paths["/v1/authority:prepareCutover"].post["x-read-only-proposal"], true);
  assert.equal(spec.components.requestBodies.createMultiDocumentChangeset.content["application/json"].schema.properties.targets.maxItems, 18);
  assert.ok(spec.components.requestBodies.mutationEnvelope.content["application/json"].schema.properties.documentId);
  assert.equal(spec.paths["/v1/release-deployments:stage"].post["x-service-only"], true);
  assert.equal(spec.paths["/v1/release-deployments/{transactionId}:recordReceipt"].post["x-active-pointer-cas"], true);
  assert.equal(spec.paths["/v1/release-deployments:pending"].post["x-content-free"], true);
  assert.equal(spec.paths["/v1/release-deployments/{transactionId}:reconcileReceipt"].post["x-allows-expired-staged-transaction"], true);
  assert.equal(spec.paths["/v1/release-deployments/{transactionId}:abandon"].post["x-requires-exact-recovery-version"], true);
  assert.equal(spec.paths["/v1/releases/{releaseId}:stageRollback"].post["x-agent-safe"], undefined);
  assert.equal(spec.paths["/v1/releases/{releaseId}:auditState"].post["x-complete-authority-map"], true);
  assert.equal(spec.paths["/v1/releases/{releaseId}:auditState"].post["x-canonical-head-binding"], true);
  assert.deepEqual(spec.paths["/v1/release-deployments:stage"].post["x-required-identity"], { actorType: "service", actorId: "actor_release_workflow", clientId: "github-content-release" });
  assert.deepEqual(spec.paths["/v1/changesets/{changesetId}:renderPreview"].post["x-preview-properties"], { immutableSnapshot: true, oneTime: true, ttlSeconds: 300, authoringCredentials: false });
  assert.deepEqual(spec.components.requestBodies.mutationEnvelope.content["application/json"].schema.properties.operation.properties.type.enum, ["text.replace", "chapter.replaceDocument", "chapter.replaceDocumentV3", "chapter.replaceDocumentV4", "chapter.replaceBody", "chapter.importPlainText", "block.insert", "block.split", "block.join", "block.move", "block.remove", "checkpoint.upsert", "checkpoint.replace", "checkpoint.move", "checkpoint.remove", "embed.upsert", "media.place", "media.remove", "personFeature.upsert", "managedPlacement.move", "managedPlacement.remove", "cardPresentation.set", "cardPresentation.reset", "cardFrame.set", "cardFrame.reset", "layoutRegion.create", "layoutRegion.update", "layoutRegion.remove", "layoutRegion.reconcile"]);
  assert.deepEqual(spec.components.schemas.flowPosition.oneOf.map((item: { required: string[] }) => item.required[0]), ["beforeNodeId", "afterNodeId"]);
  assert.equal(spec.components.schemas.checkpointReferenceNode.properties.type.const, "checkpointRef");
  assert.equal(spec.components.schemas.checkpointMoveOperation.properties.type.const, "checkpoint.move");
  assert.equal(spec.paths["/v1/changesets/{changesetId}/operations:batch"].post["x-atomic-working-copy"], true);
  assert.equal(spec.components.requestBodies.operationBatch.content["application/json"].schema.properties.operations.maxItems, 100);
  assert.equal(spec.paths["/v1/release-assets/{sha256}"].get["x-exact-sha256-bytes"], true);
  assert.deepEqual(spec["x-rate-limits"], { persistence: "D1 fail-closed fixed window", key: "trusted actor plus client", windowSeconds: 60, mutation: 120, upload: 20 });
});
