import {
  getCollection,
  render,
  type CollectionEntry,
} from "astro:content";

export interface ChapterPart {
  id: string;
  order: number;
  chapterOrder: number;
  title: string;
  slug: string;
}

export interface ChapterMeta {
  schemaVersion: 1;
  id: string;
  contentKey: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  order: number;
  part: ChapterPart;
  path: string;
  wordCount: number;
  readingMinutes: number;
  pressbooksUrl: string;
  status: "website-canonical";
  licenses: {
    prose: "CC-BY-4.0";
    code: "MIT";
    originalMetadata: "CC0-1.0";
    thirdPartyExceptions: string[];
  };
  rightsRecordIds: string[];
  exports: {
    print: boolean;
    offlineHtml: boolean;
    readingJson: boolean;
    plainText: boolean;
  };
  pressbooks: {
    id: number;
    sourceFormat: "gfm+raw-html";
    compatible: boolean;
    validated: boolean;
    publishAuthorized: boolean;
    priorRelease: {
      sourceSha256: string;
      deploymentSha256: string;
      publishedAt: string;
    };
  };
  websiteBaseline: {
    selectedSourceSha256: string;
    canonicalMarkdownSha256: string;
    reconciliationTransformations: Array<{
      kind: "replace-exact";
      reason: string;
      expectedOccurrences: number;
    }>;
    selectionNote: string;
  };
}

export type ChapterSummary = Pick<
  ChapterMeta,
  | "id"
  | "slug"
  | "title"
  | "subtitle"
  | "description"
  | "order"
  | "part"
  | "path"
  | "wordCount"
  | "readingMinutes"
  | "pressbooksUrl"
>;

export type Book = CollectionEntry<"book">["data"];
export type ChapterAnnotations = CollectionEntry<"chapterAnnotations">["data"];
export type ChapterSourceLinks = CollectionEntry<"chapterSources">["data"];
export type ChapterWorld = CollectionEntry<"chapterWorld">["data"];
export type ChapterRights = CollectionEntry<"chapterRights">["data"];
export type ChapterReading = CollectionEntry<"chapterReading">["data"];
type RenderedChapter = Awaited<ReturnType<typeof render>>;

export interface ChapterBundle {
  meta: ChapterMeta;
  entry: CollectionEntry<"chapters">;
  Content: RenderedChapter["Content"];
  headings: RenderedChapter["headings"];
  annotations: ChapterAnnotations;
  sourceLinks: ChapterSourceLinks;
  world: ChapterWorld;
  rights: ChapterRights;
  reading: ChapterReading;
  previous: ChapterSummary | null;
  next: ChapterSummary | null;
}

interface ContentIndex {
  book: CollectionEntry<"book">;
  chapters: CollectionEntry<"chapters">[];
  meta: CollectionEntry<"chapterMeta">[];
  annotations: CollectionEntry<"chapterAnnotations">[];
  sourceLinks: CollectionEntry<"chapterSources">[];
  world: CollectionEntry<"chapterWorld">[];
  rights: CollectionEntry<"chapterRights">[];
  reading: CollectionEntry<"chapterReading">[];
}

let contentIndex: Promise<ContentIndex> | undefined;

async function loadContentIndex(): Promise<ContentIndex> {
  contentIndex ??= Promise.all([
    getCollection("book"),
    getCollection("chapters"),
    getCollection("chapterMeta"),
    getCollection("chapterAnnotations"),
    getCollection("chapterSources"),
    getCollection("chapterWorld"),
    getCollection("chapterRights"),
    getCollection("chapterReading"),
  ]).then(([books, chapters, meta, annotations, sourceLinks, world, rights, reading]) => {
    if (books.length !== 1) throw new Error(`Expected one book record; found ${books.length}`);
    return { book: books[0], chapters, meta, annotations, sourceLinks, world, rights, reading };
  });
  return contentIndex;
}

function toSummary(meta: ChapterMeta): ChapterSummary {
  const {
    id,
    slug,
    title,
    subtitle,
    description,
    order,
    part,
    path,
    wordCount,
    readingMinutes,
    pressbooksUrl,
  } = meta;
  return { id, slug, title, subtitle, description, order, part, path, wordCount, readingMinutes, pressbooksUrl };
}

function scopedRecord<T extends { chapterId: string }>(records: T[], chapterId: string, label: string): T {
  const matches = records.filter((record) => record.chapterId === chapterId);
  if (matches.length !== 1) throw new Error(`Expected one ${label} record for ${chapterId}; found ${matches.length}`);
  return matches[0];
}

export async function getBook(): Promise<Book> {
  return (await loadContentIndex()).book.data;
}

export async function getChapterSummaries(): Promise<ChapterSummary[]> {
  const index = await loadContentIndex();
  return index.meta
    .map((entry) => toSummary(entry.data as ChapterMeta))
    .sort((left, right) => left.order - right.order);
}

export async function getChapterSlugs(): Promise<string[]> {
  return (await getChapterSummaries()).map((chapter) => chapter.slug);
}

export async function getAdjacentChapters(
  slug: string,
): Promise<{ previous: ChapterSummary | null; next: ChapterSummary | null }> {
  const summaries = await getChapterSummaries();
  const index = summaries.findIndex((chapter) => chapter.slug === slug);
  if (index < 0) return { previous: null, next: null };
  return { previous: summaries[index - 1] ?? null, next: summaries[index + 1] ?? null };
}

export async function getChapter(slug: string): Promise<ChapterBundle | undefined> {
  const index = await loadContentIndex();
  const metaEntry = index.meta.find((entry) => entry.data.slug === slug);
  if (!metaEntry) return undefined;
  const meta = metaEntry.data as ChapterMeta;
  const entry = index.chapters.find((candidate) => candidate.id.startsWith(`${meta.contentKey}/`));
  if (!entry) throw new Error(`Missing chapter Markdown for ${meta.id}`);
  const rendered = await render(entry);
  const { previous, next } = await getAdjacentChapters(slug);
  return {
    meta,
    entry,
    Content: rendered.Content,
    headings: rendered.headings,
    annotations: scopedRecord(index.annotations.map((item) => item.data), meta.id, "annotations"),
    sourceLinks: scopedRecord(index.sourceLinks.map((item) => item.data), meta.id, "source-links"),
    world: scopedRecord(index.world.map((item) => item.data), meta.id, "world"),
    rights: scopedRecord(index.rights.map((item) => item.data), meta.id, "rights"),
    reading: scopedRecord(index.reading.map((item) => item.data), meta.id, "reading"),
    previous,
    next,
  };
}

export async function requireChapter(slug: string): Promise<ChapterBundle> {
  const chapter = await getChapter(slug);
  if (!chapter) throw new Error(`Unknown chapter slug: ${slug}`);
  return chapter;
}
