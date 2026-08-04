/** Provider-neutral read repository and lossless Git import adapter. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  BookReleaseSnapshotSchema,
  type BookReleaseSnapshot,
  type ChapterBundle,
} from "@ai-ethics/content-contract";

export interface ContentRepository {
  getBook(): Promise<BookReleaseSnapshot>;
  getChapter(chapterId: string): Promise<ChapterBundle | undefined>;
  exportSnapshot(): Promise<SnapshotExport>;
}

export interface SnapshotExport {
  snapshot: BookReleaseSnapshot;
  canonicalJson: string;
  sha256: string;
  report: ImportReport;
}

export interface ImportReport {
  chapterCount: number;
  sectionCount: number;
  passageCount: number;
  checkpointCount: number;
  annotationCount: number;
  sourceCount: number;
  legacyMarkupBlocks: number;
  blockTypeCounts: Record<string, number>;
  notes: string[];
}

type Json = Record<string, any>;
const SOURCE_FORMAT = "git-markdown-v1";
const actor = { actorId: "actor_git_importer", actorType: "service" as const, displayName: "Git content importer" };

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
export function sha256(value: unknown): string { return createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex"); }
const safe = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, "_");
const chapterId = (id: string) => `chapter_${safe(id)}`;
const sectionId = (id: string) => `section_${safe(id)}`;
const passageId = (id: string) => `passage_${safe(id)}`;
const blockId = (kind: string, sourceId: string) => `block_${kind}_${safe(sourceId)}`;
const revisionId = (source: string) => `revision_${sha256(source).slice(0, 24)}`;
const checkpointId = (source: string) => `checkpoint_${safe(source)}`;
const worldId = (source: string) => `world_${safe(source)}`;
const placementId = (chapter: string, person: string, anchor: string, ordinal: number) => `placement_${sha256(`${chapter}:${person}:${anchor}:${ordinal}`).slice(0, 24)}`;
const personFeatureId = (chapter: string, person: string, anchor: string, ordinal: number) => `personfeature_${sha256(`${chapter}:${person}:${anchor}:${ordinal}`).slice(0, 24)}`;
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const lockedMarkdown = (markdown: string) => `<pre data-content-source="${SOURCE_FORMAT}">${escapeHtml(markdown)}</pre>`;

async function readJson(filePath: string): Promise<Json> { return JSON.parse(await readFile(filePath, "utf8")); }
function legacy(block: string, sourceId: string, anchorPassageId?: string) {
  return { type: "legacyMarkup" as const, blockId: blockId("legacy", sourceId), ...(anchorPassageId ? { anchorPassageId } : {}), locked: true as const, sanitizedHtml: lockedMarkdown(block), importedFrom: SOURCE_FORMAT };
}

/**
 * The importer maps standard Markdown blocks conservatively. Raw HTML and unknown custom
 * constructs remain one locked block at their original passage boundary; ordinary Markdown
 * never falls back merely because it contains inline links or emphasis.
 */
export class GitContentRepository implements ContentRepository {
  constructor(private readonly root: string) {}

  async getChapter(requestedId: string): Promise<ChapterBundle | undefined> {
    const snapshot = await this.import();
    return snapshot.chapters.find((chapter) => chapter.chapterId === requestedId || chapter.aliases.some((alias) => alias.fromId === requestedId));
  }
  async getBook(): Promise<BookReleaseSnapshot> { return this.import(); }
  async exportSnapshot(): Promise<SnapshotExport> {
    const snapshot = await this.import();
    const canonicalJson = stableStringify(snapshot);
    return { snapshot, canonicalJson, sha256: sha256(canonicalJson), report: this.lastReport! };
  }
  private lastReport?: ImportReport;

  private async import(): Promise<BookReleaseSnapshot> {
    const book = await readJson(path.join(this.root, "book.json"));
    const chapters: any[] = [];
    const report: ImportReport = { chapterCount: 0, sectionCount: 0, passageCount: 0, checkpointCount: 0, annotationCount: 0, sourceCount: 0, legacyMarkupBlocks: 0, blockTypeCounts: {}, notes: ["Typed blocks cover standard Markdown. Locked legacyMarkup is limited to raw HTML/custom constructs and exact auxiliary JSON payloads not represented by the contract."] };
    for (const part of [...book.parts].sort((a: Json, b: Json) => a.order - b.order)) {
      for (const entry of [...part.chapters].sort((a: Json, b: Json) => a.order - b.order)) {
        chapters.push(await this.importChapter(entry, part, report));
      }
    }
    const contentObjects: Record<string, any> = {};
    const authorityRegistry: Record<string, any> = {};
    for (const chapter of chapters) {
      const digest = sha256(chapter);
      contentObjects[chapter.chapterId] = { type: "chapter", domainRevisionId: chapter.revisionId, sha256: digest };
      authorityRegistry[chapter.chapterId] = { authority: "git", gitSha: digest, sourcePath: `content/chapters/${chapter.contentKey}/`, normalizedSnapshotHash: digest };
    }
    const snapshot = { schemaVersion: 2 as const, book: { bookId: "book_phil_123_ai_ethics", title: book.title, version: book.edition }, parts: book.parts.map((part: Json) => ({ partId: `part_${safe(part.id)}`, title: part.title, order: part.order })), chapters, contentObjects, authorityRegistry };
    this.lastReport = report;
    return BookReleaseSnapshotSchema.parse(snapshot);
  }

  private async importChapter(entry: Json, part: Json, report: ImportReport): Promise<any> {
    const directory = path.join(this.root, "chapters", entry.path ? path.basename(path.dirname(entry.path)) : `${String(entry.order).padStart(2, "0")}-${entry.slug}`);
    // book.json paths are reader paths; contentKey is the authoritative local directory name.
    const contentKey = `${String(entry.order).padStart(2, "0")}-${entry.slug}`;
    const source = path.join(this.root, "chapters", contentKey);
    const [meta, markdown, readingRecord, annotations, sourceLinks, world, rights] = await Promise.all([
      readJson(path.join(source, "meta.json")), readFile(path.join(source, "chapter.md"), "utf8"), readJson(path.join(source, "reading-record.json")), readJson(path.join(source, "annotations.json")), readJson(path.join(source, "source-links.json")), readJson(path.join(source, "world.json")), readJson(path.join(source, "rights.json")),
    ]);
    void directory;
    const parsed = parseMarkdown(markdown, report);
    const aliases = [...parsed.aliases, { fromId: entry.id, toId: chapterId(entry.id), reason: "Preserves Git chapter identity", createdAt: "2026-08-02T00:00:00.000Z" }];
    const checkpoints = readingRecord.checkpoints.map((item: Json, index: number) => ({
      checkpointId: checkpointId(item.id), legacyId: item.id, passageId: passageId(item.passageId), passageExcerptHash: sha256(parsed.passageSource.get(item.passageId) ?? ""), displayOrder: index, slotLabel: item.slot ?? (["commit", "work", "reconcile"] as const)[index] ?? `checkpoint-${index + 1}`, ...(item.stage ? { stage: item.stage } : {}), strategy: item.strategy, title: item.title, trigger: item.trigger, prompt: item.prompt, guidance: item.guidance, responseStructure: item.responseStructure, minWords: 30, maxWords: 250, showInSidebar: true, rationale: item.rationale,
    }));
    const sources = [...(sourceLinks.primarySources ?? []), ...(sourceLinks.companionSources ?? [])].map((item: Json) => ({ referenceId: `reference_${safe(item.id)}`, label: item.title, ...(item.url ? { url: item.url } : {}) }));
    const people = (world.people ?? []).map((item: Json) => ({ personId: item.id, role: item.role ?? "mentioned", passageIds: (item.passageIds ?? []).map(passageId) }));
    const { entityRevisions, personFeatures, managedPlacements } = await this.importPersonFeatures({ source, chapterId: chapterId(entry.id), world, sourceLinks, parsed });
    const sideMetadata = { annotations, sourceLinks, world, rights };
    // Exact source metadata is retained in a locked block because the current public contract
    // deliberately has no arbitrary metadata bag. The normalized projections below remain queryable.
    parsed.body.push(legacy(JSON.stringify(sideMetadata), `${entry.id}_metadata`)); countBlock(report, "legacyMarkup");
    report.chapterCount += 1; report.checkpointCount += checkpoints.length; report.annotationCount += annotations.items.length; report.sourceCount += sources.length;
    return {
      schemaVersion: 2, chapterId: chapterId(entry.id), contentKey, slug: entry.slug, title: meta.title, ...(meta.subtitle ? { subtitle: meta.subtitle } : {}), description: meta.description, part: { partId: `part_${safe(part.id)}`, title: part.title, order: part.order }, order: entry.order, chapterVersion: meta.websiteBaseline?.canonicalMarkdownSha256 ?? sha256(markdown), revisionId: revisionId(markdown), body: parsed.body, reasoningObjective: readingRecord.reasoningObjective ?? "Legacy source did not specify a reasoning objective.", readingRecordLicense: readingRecord.license ?? "CC0-1.0", sidePanelModules: [{ moduleId: `module_reading_${safe(entry.id)}`, type: "readingRecord", order: 0 }, { moduleId: `module_sources_${safe(entry.id)}`, type: "sources", order: 1 }], annotations: annotations.items.map((item: Json) => ({ annotationId: `annotation_${safe(item.id ?? sha256(item).slice(0, 16))}`, passageId: passageId(item.passageId), body: item.body ?? JSON.stringify(item) })), sources, people, entityRevisions, personFeatures, managedPlacements, concepts: (world.concepts ?? []).map((item: Json) => ({ entityId: item.id, relation: item.role ?? "mentioned" })), traditions: (world.traditions ?? []).map((item: Json) => ({ entityId: item.id, relation: item.role ?? "mentioned" })), worldLayer: { worldLayerId: worldId(entry.id), version: String(world.schemaVersion ?? 1) }, diagrams: [], mediaPlacementIds: [], rightsCaseIds: (rights.rightsRecordIds ?? []).map((id: string) => `rights_${safe(id)}`), licenses: { chapter: rights.proseLicense ?? "CC-BY-4.0", assets: rights.thirdPartyExceptions ?? [] }, exports: { web: true, print: Boolean(meta.exports?.print), offline: Boolean(meta.exports?.offlineHtml), voice: true }, aliases, tombstones: [], updatedBy: actor, updatedAt: "2026-08-02T00:00:00.000Z", status: "approved", checkpoints,
    };
  }

  /**
   * The live reader anchors featured cards at the first in-prose person link and only
   * falls back to world.passageIds. Persist that resolved anchor once so later editor
   * and renderer implementations never repeat an implicit DOM-placement heuristic.
   */
  private async importPersonFeatures({ source, chapterId: chapter, world, sourceLinks, parsed }: { source: string; chapterId: string; world: Json; sourceLinks: Json; parsed: ReturnType<typeof parseMarkdown> }) {
    const entityRevisions: Json[] = []; const personFeatures: Json[] = []; const managedPlacements: Json[] = [];
    const seenPersons = new Set<string>(); const ordinals = new Map<string, number>();
    for (const relation of world.people ?? []) {
      if (relation.featured !== true) continue;
      const person = String(relation.id ?? "");
      const fallback = Array.isArray(relation.passageIds) ? relation.passageIds.find((item: unknown) => typeof item === "string") : undefined;
      const linkedPassage = [...parsed.passageSource.entries()].find(([, value]) => value.includes(`](/people/${person}/)`))?.[0];
      const sourceAnchor = linkedPassage ?? fallback;
      if (!person || !sourceAnchor) throw new Error(`Featured person ${person || "(missing id)"} in ${chapter} has no resolvable placement anchor`);
      const anchor = passageId(sourceAnchor); const ordinalKey = `${anchor}:after`; const ordinal = ordinals.get(ordinalKey) ?? 0; ordinals.set(ordinalKey, ordinal + 1);
      const placement = placementId(chapter, person, anchor, ordinal); const feature = personFeatureId(chapter, person, anchor, ordinal);
      const record = await readJson(path.join(source, "../../entities/people/records", `${person}.json`));
      const portraitId = String(record.portraitId ?? "");
      if (!portraitId) throw new Error(`Featured person ${person} in ${chapter} has no reviewed portrait record`);
      const [portrait, media] = await Promise.all([
        readJson(path.join(source, "../../media/wikimedia", `${portraitId}.json`)),
        readJson(path.join(source, "../../media/records", `${portraitId}.json`)),
      ]);
      const entityRevisionId = revisionId(stableStringify(record));
      if (!seenPersons.has(person)) {
        entityRevisions.push({ entityRevisionId, personId: person, sha256: sha256(record), sourcePath: `content/entities/people/records/${person}.json` });
        seenPersons.add(person);
      }
      const primarySources = (sourceLinks.primarySources ?? []).filter((item: Json) => item.authorPersonId === person).map((item: Json) => ({ sourceId: String(item.id), title: item.title, creator: item.creator ?? record.displayName, ...(item.locator ? { locator: item.locator } : {}), ...(item.translation ? { translation: item.translation } : {}), ...(item.excerpt ? { excerpt: item.excerpt } : {}), teachingUse: item.teachingUse ?? "Primary source linked from this chapter.", label: "Read the public text", ...(item.url ? { url: item.url } : {}) }));
      personFeatures.push({ personFeatureId: feature, placementId: placement, personId: person, entityRevisionId, name: record.displayName, dates: record.lifeDates, role: relation.role ?? record.teaching?.whyThisPerson ?? "mentioned", teachingNote: record.teaching?.whyThisPerson ?? "", biography: record.biography, primarySources, portrait: { mediaVersionId: `mediaVersion_${safe(portrait.id)}`, src: portrait.derivative.localPath, width: portrait.derivative.width, height: portrait.derivative.height, alt: media.alt, credit: portrait.rights.credit, title: media.title ?? portrait.commonsTitle, ...(portrait.rights.artist ? { creator: portrait.rights.artist } : {}), ...(portrait.derivative.modification ? { derivativeModification: portrait.derivative.modification } : {}), license: portrait.rights.licenseShortName, ...(portrait.rights.licenseUrl ? { licenseUrl: portrait.rights.licenseUrl } : {}), ...(portrait.derivative.sourceUrl ? { sourceUrl: portrait.derivative.sourceUrl } : {}), ...(portrait.source.pageUrl ? { commonsPageUrl: portrait.source.pageUrl } : {}), ...(portrait.source.revisionId ? { reviewedSourceRevision: String(portrait.source.revisionId) } : {}) }, displayPreset: "thinker-card" });
      managedPlacements.push({ placementId: placement, kind: "personFeature", contentId: feature, anchorPassageId: anchor, position: "after", orderAtAnchor: ordinal, displayPreset: "thinker-card" });
    }
    return { entityRevisions, personFeatures, managedPlacements };
  }
}

function parseMarkdown(markdown: string, report: ImportReport) {
  const lines = markdown.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const body: any[] = []; const aliases: any[] = []; const passageSource = new Map<string, string>();
  let index = 0;
  while (index < lines.length) {
    const section = lines[index].match(/^<!-- phil-section-id: ([a-z0-9-]+) -->$/);
    const passage = lines[index].match(/^<!-- phil-passage-id: ([a-z0-9-]+) -->$/);
    if (!section && !passage) { index += 1; continue; }
    const sourceId = (section ?? passage)![1]; index += 1;
    const start = index; while (index < lines.length && !/^<!-- phil-(?:section|passage)-id: /.test(lines[index])) index += 1;
    const chunk = lines.slice(start, index).join("\n").trim();
    if (section) {
      const heading = chunk.match(/^(#{2,6})\s+(.+)$/);
      aliases.push({ fromId: sourceId, toId: sectionId(sourceId), reason: "Preserves Git section identity", createdAt: "2026-08-02T00:00:00.000Z" }); report.sectionCount += 1;
      if (heading) { body.push({ type: "heading", blockId: blockId("heading", sourceId), sectionId: sectionId(sourceId), level: heading[1].length, text: heading[2] }); countBlock(report, "heading"); }
      else { body.push(legacy(chunk, sourceId)); countBlock(report, "legacyMarkup"); }
    } else {
      const normalized = passageId(sourceId); passageSource.set(sourceId, chunk); body.push(...parsePassage(chunk, sourceId, normalized, report)); aliases.push({ fromId: sourceId, toId: normalized, reason: "Preserves Git passage identity", createdAt: "2026-08-02T00:00:00.000Z" }); report.passageCount += 1;
    }
  }
  return { body, aliases, passageSource };
}

function countBlock(report: ImportReport, type: string) {
  report.blockTypeCounts[type] = (report.blockTypeCounts[type] ?? 0) + 1;
  if (type === "legacyMarkup") report.legacyMarkupBlocks += 1;
}

function typed(type: string, sourceId: string, ordinal: number, value: Record<string, unknown>, report: ImportReport) {
  countBlock(report, type);
  return { type, blockId: blockId(`${type}_${ordinal}`, sourceId), ...value };
}

/** Parse only block forms that can be represented without interpreting inline Markdown. */
function parsePassage(chunk: string, sourceId: string, normalizedPassageId: string, report: ImportReport): any[] {
  if (!chunk) return [];
  // A raw element can contain nested Markdown-looking text. Keeping the whole passage avoids
  // splitting a custom construct or silently changing its source semantics.
  if (/^\s*<\/?[A-Za-z][\s\S]*>\s*$/.test(chunk)) { const block = legacy(chunk, sourceId, normalizedPassageId); countBlock(report, "legacyMarkup"); return [block]; }
  const lines = chunk.split("\n"); const blocks: any[] = []; let cursor = 0; let ordinal = 0;
  const next = (type: string, value: Record<string, unknown>) => blocks.push(typed(type, sourceId, ++ordinal, value, report));
  const blank = (line: string | undefined) => !line?.trim();
  while (cursor < lines.length) {
    while (cursor < lines.length && blank(lines[cursor])) cursor += 1;
    if (cursor >= lines.length) break;
    if (/^```/.test(lines[cursor])) {
      const opener = lines[cursor++]; const language = opener.slice(3).trim(); const code: string[] = [];
      while (cursor < lines.length && !/^```\s*$/.test(lines[cursor])) code.push(lines[cursor++]);
      if (cursor === lines.length) { const block = legacy(chunk, sourceId, normalizedPassageId); countBlock(report, "legacyMarkup"); return [block]; }
      cursor += 1; next("codeBlock", { anchorPassageId: normalizedPassageId, ...(language ? { language } : {}), code: code.join("\n") }); continue;
    }
    if (/^>\s?/.test(lines[cursor])) {
      const quote: string[] = []; while (cursor < lines.length && /^>\s?/.test(lines[cursor])) quote.push(lines[cursor++].replace(/^>\s?/, ""));
      next("blockquote", { passageId: normalizedPassageId, text: quote.join("\n") }); continue;
    }
    const listMatch = lines[cursor].match(/^(\s*)([-*+] |\d+[.)] )/);
    if (listMatch) {
      const ordered = /^\s*\d+[.)] /.test(lines[cursor]); const items: string[] = [];
      while (cursor < lines.length && (ordered ? /^\s*\d+[.)] /.test(lines[cursor]) : /^\s*[-*+] /.test(lines[cursor]))) items.push(lines[cursor++].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""));
      next("list", { passageId: normalizedPassageId, ordered, text: items.join("\n"), items }); continue;
    }
    if (cursor + 1 < lines.length && /^\|.*\|\s*$/.test(lines[cursor]) && /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[cursor + 1])) {
      const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()); const columns = cells(lines[cursor]); cursor += 2; const rows: string[][] = [];
      while (cursor < lines.length && /^\|.*\|\s*$/.test(lines[cursor])) rows.push(cells(lines[cursor++]));
      next("table", { passageId: normalizedPassageId, columns, rows }); continue;
    }
    const paragraph: string[] = []; while (cursor < lines.length && !blank(lines[cursor])) paragraph.push(lines[cursor++]);
    next("paragraph", { passageId: normalizedPassageId, text: paragraph.join("\n") });
  }
  return blocks;
}
