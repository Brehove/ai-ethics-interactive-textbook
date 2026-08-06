export type RendererContext = "reader" | "editor" | "preview" | "print" | "offline";

export type OrderedChapterNode =
  | { kind: "block"; value: Record<string, unknown> }
  | { kind: "checkpoint"; value: Record<string, unknown> }
  | { kind: "personFeature"; value: Record<string, unknown> };

export interface ProjectionOptions {
  context?: RendererContext;
  persons?: Record<string, Record<string, unknown>>;
  publicOrigin?: string;
}

export interface RenderedChapterProjection {
  schemaVersion: 1;
  revisionId: string | null;
  chapterVersion: string | null;
  title: string;
  stylesheetVersion: string;
  html: string;
  prompts: Array<Record<string, unknown>>;
  orderedNodes: OrderedChapterNode[];
  projectionProvenance: "v2-anchor-adapter" | "v3-flow" | "v4-layout-flow";
}

export const CHAPTER_RENDERER_STYLES: string;
export const CHAPTER_RENDERER_STYLE_VERSION: string;
export class ChapterFlowError extends Error { code: string; path: string; }
export function projectOrderedChapter(chapter: Record<string, unknown>, options?: ProjectionOptions): OrderedChapterNode[];
export function migrateChapterV2ToV3(chapter: Record<string, unknown>, options?: ProjectionOptions): Record<string, unknown>;
export function migrateChapterV3ToV4(chapter: Record<string, unknown>): Record<string, unknown>;
export function migrateChapterToV4(chapter: Record<string, unknown>, options?: ProjectionOptions): Record<string, unknown>;
export function exportChapterV3AsV2(chapter: Record<string, unknown>): Record<string, unknown>;
export function renderOrderedNode(node: OrderedChapterNode, options?: ProjectionOptions): string;
export function renderChapterProjection(chapter: Record<string, unknown>, options?: ProjectionOptions): RenderedChapterProjection;
export function normalizeRenderedHtml(html: string): string;
export function stripAuthorDecorations(html: string): string;
export function stableProjectionJson(value: unknown): string;
export function projectionIdentity(value: unknown): Promise<string>;
