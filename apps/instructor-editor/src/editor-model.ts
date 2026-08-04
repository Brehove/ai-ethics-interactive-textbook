export type ProseBlock = Record<string, unknown> & { type: "paragraph" | "heading" | "blockquote" | "list" | "callout"; blockId: string; passageId?: string; anchorPassageId?: string; text?: string; level?: number; items?: string[]; ordered?: boolean; tone?: string };
export type ManagedBodyBlock = Record<string, unknown> & { type: "mediaFigure" | "externalEmbed" | "richLink" | "diagram" | "artifact" | "legacyMarkup"; blockId: string; anchorPassageId?: string };
export type ChapterBlock = ProseBlock | ManagedBodyBlock;
export type Checkpoint = Record<string, unknown> & { checkpointId: string; passageId: string; displayOrder: number; title: string; trigger: string; prompt: string; guidance: string; stage?: string; strategy: string; responseStructure: "prose" | "movement-plus-prose"; minWords: number; maxWords: number; showInSidebar: boolean; rationale: string };
export type ManagedPlacement = { placementId: string; kind: "personFeature" | "media" | "embed" | "diagram" | "artifact"; contentId: string; anchorPassageId: string; position: "before" | "after"; orderAtAnchor: number; displayPreset: "thinker-card" | "narrow" | "reading" | "wide" | "bleed" | "compact" };
export type PersonFeature = Record<string, unknown> & { personFeatureId: string; placementId: string; personId: string; name: string; displayPreset: "thinker-card" };
export type ChapterDocument = Record<string, unknown> & { documentId: string; chapterId: string; changeSetId: string; slug: string; title: string; revisionId: string; baseRevisionId: string; expectedVersion: number; body: ChapterBlock[]; checkpoints: Checkpoint[]; personFeatures: PersonFeature[]; managedPlacements: ManagedPlacement[] };

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
export const cloneChapter = (chapter: ChapterDocument): ChapterDocument => structuredClone(chapter);
export const blockPassage = (block: ChapterBlock) => String(block.passageId ?? block.anchorPassageId ?? "");
type AnchorNode = { kind: "checkpoint"; item: Checkpoint; order: number; index: number; sequence: number }
  | { kind: "placement"; item: ManagedPlacement; order: number; index: number; sequence: number };
const orderedAnchor = (chapter: ChapterDocument, anchor: string, excludedId?: string): AnchorNode[] => [
  ...chapter.checkpoints.map((item, index) => ({ kind: "checkpoint" as const, item, order: item.displayOrder, index, sequence: 0 }))
    .filter((node) => node.item.passageId === anchor && node.item.checkpointId !== excludedId),
  ...chapter.managedPlacements.map((item, index) => ({ kind: "placement" as const, item, order: item.orderAtAnchor, index, sequence: 1 }))
    .filter((node) => node.item.anchorPassageId === anchor && node.item.position !== "before"),
].sort((a, b) => {
  const orderDifference = a.order - b.order;
  if (orderDifference) return orderDifference;
  const kindDifference = a.sequence - b.sequence;
  if (kindDifference) return kindDifference;
  const leftId = a.kind === "checkpoint" ? a.item.checkpointId : a.item.placementId;
  const rightId = b.kind === "checkpoint" ? b.item.checkpointId : b.item.placementId;
  return leftId.localeCompare(rightId) || a.index - b.index;
});
export const nextCheckpointOrder = (chapter: ChapterDocument, anchor: string) => Math.max(-1, ...orderedAnchor(chapter, anchor).map((node) => node.order)) + 1;
export function updateCheckpointDetails(checkpoint: Checkpoint, update: { title: string; prompt: string; guidance: string; stage?: string; trigger: string; strategy: string; responseStructure: "prose" | "movement-plus-prose"; minWords: number; maxWords: number; showInSidebar: boolean; rationale: string }) {
  const required = { title: update.title.trim(), prompt: update.prompt.trim(), trigger: update.trigger.trim(), strategy: update.strategy.trim(), rationale: update.rationale.trim() };
  if (Object.values(required).some((value) => !value)) throw new Error("Checkpoint title, prompt, trigger, strategy, and rationale are required.");
  if (!Number.isInteger(update.minWords) || !Number.isInteger(update.maxWords) || update.minWords < 1 || update.maxWords > 1000 || update.minWords > update.maxWords) throw new Error("Checkpoint word guidance must be between 1 and 1000, with the minimum no greater than the maximum.");
  if (!["prose", "movement-plus-prose"].includes(update.responseStructure)) throw new Error("Checkpoint response structure is invalid.");
  checkpoint.title = required.title;
  checkpoint.prompt = required.prompt;
  checkpoint.trigger = required.trigger;
  checkpoint.guidance = update.guidance.trim();
  checkpoint.strategy = required.strategy;
  checkpoint.responseStructure = update.responseStructure;
  checkpoint.minWords = update.minWords;
  checkpoint.maxWords = update.maxWords;
  checkpoint.showInSidebar = update.showInSidebar;
  checkpoint.rationale = required.rationale;
  const stage = update.stage?.trim();
  if (stage) checkpoint.stage = stage; else delete checkpoint.stage;
  return checkpoint;
}
export const checkpointExcerpt = (block?: ChapterBlock) => {
  if (!block) return "";
  if (block.type === "externalEmbed" || block.type === "richLink") {
    const fallback = block.fallback && typeof block.fallback === "object" ? block.fallback as Record<string, unknown> : {};
    return [block.title ?? fallback.title ?? block.caption ?? "External resource", block.summary ?? fallback.summary ?? block.teachingUse, block.linkLabel ?? fallback.linkLabel ?? "Open canonical source"].filter((value): value is string => typeof value === "string" && Boolean(value)).join("\n");
  }
  if (block.type === "mediaFigure") return [block.decorative ? undefined : block.alt, block.caption, block.creditOverride ?? block.credit].filter((value): value is string => typeof value === "string" && Boolean(value)).join("\n");
  if (block.type === "list" && Array.isArray(block.items)) return block.items.map(String).join("\n");
  if (typeof block.text === "string") return block.text;
  if (typeof block.code === "string") return block.code;
  const tableCells = [
    ...(Array.isArray(block.columns) ? block.columns : []),
    ...(Array.isArray(block.rows) ? block.rows.flat() : []),
  ];
  if (tableCells.length) return tableCells.map(String).join("\n");
  if (typeof block.sanitizedHtml === "string") return block.sanitizedHtml;
  return [block.caption, block.alt, block.teachingUse, block.title, block.summary, block.description]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
};
const legacyPassages = (chapter: ChapterDocument) => Array.isArray(chapter.passages) ? chapter.passages as ChapterBlock[] : [];
export const checkpointAnchorBlock = (chapter: ChapterDocument, passageId: string) => chapter.body.find((block) => block.passageId === passageId)
  ?? chapter.body.find((block) => blockPassage(block) === passageId)
  ?? legacyPassages(chapter).find((block) => block.passageId === passageId);
export function nearestPassage(chapter: ChapterDocument, passageId?: string) {
  const available = [...chapter.body, ...legacyPassages(chapter)].map(blockPassage).filter(Boolean);
  if (passageId) {
    const exact = available.find((value) => value === passageId || value.replace(/^passage_/, "") === passageId || passageId.replace(/^passage_/, "") === value);
    if (exact) return exact;
  }
  return available[0] ?? "";
}
export function addCheckpoint(chapter: ChapterDocument, draft: Omit<Checkpoint, "checkpointId" | "displayOrder" | "passageId">, passageId: string) {
  const anchor = nearestPassage(chapter, passageId); const checkpoint: Checkpoint = { checkpointId: newId("checkpoint"), passageId: anchor, displayOrder: nextCheckpointOrder(chapter, anchor), ...draft }; chapter.checkpoints.push(checkpoint); return checkpoint;
}
export function moveCheckpoint(chapter: ChapterDocument, checkpointId: string, passageId: string, displayOrder: number, passageExcerptHash?: string) {
  const checkpoint = chapter.checkpoints.find((item) => item.checkpointId === checkpointId);
  if (!checkpoint) throw new Error("The selected checkpoint is unavailable.");
  const previousAnchor = checkpoint.passageId;
  const nextAnchor = nearestPassage(chapter, passageId);
  if (previousAnchor !== nextAnchor && !/^[a-f0-9]{64}$/.test(passageExcerptHash ?? "")) throw new Error("Moving a checkpoint requires the destination passage excerpt hash.");
  const reindex = (nodes: AnchorNode[]) => nodes.forEach((node, index) => {
    if (node.kind === "checkpoint") node.item.displayOrder = index;
    else node.item.orderAtAnchor = index;
  });
  const currentSequence = orderedAnchor(chapter, previousAnchor);
  const currentPosition = currentSequence.findIndex((node) => node.kind === "checkpoint" && node.item.checkpointId === checkpointId);
  const requested = Number.isInteger(displayOrder) ? Math.max(0, displayOrder) : currentPosition;
  const requestedAtCurrentAnchor = Math.min(requested, Math.max(0, currentSequence.length - 1));
  if (previousAnchor === nextAnchor && requestedAtCurrentAnchor === currentPosition) return checkpoint;
  const target = orderedAnchor(chapter, nextAnchor, checkpointId);
  const insertionIndex = Math.min(requested, target.length);
  target.splice(insertionIndex, 0, { kind: "checkpoint", item: checkpoint, order: checkpoint.displayOrder, index: chapter.checkpoints.indexOf(checkpoint), sequence: 0 });
  checkpoint.passageId = nextAnchor;
  if (previousAnchor !== nextAnchor) checkpoint.passageExcerptHash = passageExcerptHash;
  reindex(target);
  if (previousAnchor !== nextAnchor) reindex(orderedAnchor(chapter, previousAnchor, checkpointId));
  return checkpoint;
}
export function addPersonFeature(chapter: ChapterDocument, personFeatureId: string, passageId: string) {
  const source = chapter.personFeatures.find((item) => item.personFeatureId === personFeatureId); if (!source) throw new Error("The selected frozen person feature is unavailable.");
  const anchor = nearestPassage(chapter, passageId); const placementId = newId("placement"); const nextFeatureId = newId("personfeature");
  const feature: PersonFeature = { ...structuredClone(source), personFeatureId: nextFeatureId, placementId };
  const placement: ManagedPlacement = { placementId, kind: "personFeature", contentId: nextFeatureId, anchorPassageId: anchor, position: "after", orderAtAnchor: chapter.managedPlacements.filter((item) => item.anchorPassageId === anchor && item.position === "after").length, displayPreset: "thinker-card" };
  chapter.personFeatures.push(feature); chapter.managedPlacements.push(placement); return { feature, placement };
}
export const chapterReplaceOperation = (chapter: ChapterDocument): Record<string, unknown> => {
  const { documentId: _documentId, changeSetId: _changeSetId, baseRevisionId: _baseRevisionId, expectedVersion: _expectedVersion, ...document } = chapter;
  const body = document.body.map((block) => {
    if (block.type !== "mediaFigure") return block;
    // These values are hydrated only in the editor so its canvas can show the
    // real managed asset. Canonical media remains the immutable
    // media/version/rights reference plus authored accessibility metadata.
    const { src: _src, posterUrl: _posterUrl, derivativeUrl: _derivativeUrl, editorPreviewUrl: _editorPreviewUrl, previewUrl: _previewUrl, previewPath: _previewPath, credit: _projectedCredit, ...canonical } = block;
    return canonical;
  });
  return { type: "chapter.replaceDocument", document: { ...document, body } };
};
export function chapterFromAuthoringView(view: Record<string, unknown>, fallback: ChapterDocument): ChapterDocument {
  const candidate = (view.chapter ?? view.document ?? view) as Partial<ChapterDocument>; if (!Array.isArray(candidate.body)) return fallback;
  const outer = view as Partial<ChapterDocument>;
  return { ...fallback, ...candidate, documentId: String(outer.documentId ?? candidate.documentId ?? candidate.chapterId ?? fallback.documentId), chapterId: String(candidate.chapterId ?? outer.documentId ?? fallback.chapterId), changeSetId: String(outer.changeSetId ?? candidate.changeSetId ?? fallback.changeSetId), revisionId: String(outer.revisionId ?? candidate.revisionId ?? fallback.revisionId), baseRevisionId: String(outer.baseRevisionId ?? candidate.baseRevisionId ?? outer.revisionId ?? candidate.revisionId ?? fallback.baseRevisionId), expectedVersion: Number(outer.expectedVersion ?? outer.workingVersion ?? outer.version ?? candidate.expectedVersion ?? candidate.workingVersion ?? candidate.version ?? fallback.expectedVersion), body: candidate.body as ChapterBlock[], checkpoints: Array.isArray(candidate.checkpoints) ? candidate.checkpoints as Checkpoint[] : [], personFeatures: Array.isArray(candidate.personFeatures) ? candidate.personFeatures as PersonFeature[] : [], managedPlacements: Array.isArray(candidate.managedPlacements) ? candidate.managedPlacements as ManagedPlacement[] : [] };
}
