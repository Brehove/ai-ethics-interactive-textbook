import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const partSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  chapterOrder: z.number().int().positive(),
  title: z.string(),
  slug: z.string(),
});

export const chapterMetaSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  contentKey: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  description: z.string(),
  order: z.number().int().min(1).max(18),
  part: partSchema,
  path: z.string(),
  wordCount: z.number().int().positive(),
  readingMinutes: z.number().int().positive(),
  pressbooksUrl: z.url(),
  status: z.literal("website-canonical"),
  licenses: z.object({
    prose: z.literal("CC-BY-4.0"),
    code: z.literal("MIT"),
    originalMetadata: z.literal("CC0-1.0"),
    thirdPartyExceptions: z.array(z.string()),
  }),
  rightsRecordIds: z.array(z.string()),
  exports: z.object({
    print: z.boolean(),
    offlineHtml: z.boolean(),
    readingJson: z.boolean(),
    plainText: z.boolean(),
  }),
  pressbooks: z.object({
    id: z.number().int().positive(),
    sourceFormat: z.literal("gfm+raw-html"),
    compatible: z.boolean(),
    validated: z.boolean(),
    publishAuthorized: z.boolean(),
    priorRelease: z.object({
      sourceSha256: z.string().length(64),
      deploymentSha256: z.string().length(64),
      publishedAt: z.string(),
    }),
  }),
  websiteBaseline: z.object({
    selectedSourceSha256: z.string().length(64),
    canonicalMarkdownSha256: z.string().length(64),
    reconciliationTransformations: z.array(z.object({
      kind: z.literal("replace-exact"),
      reason: z.string(),
      expectedOccurrences: z.number().int().positive(),
    })),
    selectionNote: z.string(),
  }),
});

const chapterScopedMetadata = z.object({
  schemaVersion: z.literal(1),
  chapterId: z.string(),
});

const chapters = defineCollection({
  loader: glob({
    pattern: "**/chapter.md",
    base: "./content/chapters",
    retainBody: true,
    deferRender: true,
  }),
  schema: z.object({}),
});

const chapterMeta = defineCollection({
  loader: glob({ pattern: "**/meta.json", base: "./content/chapters" }),
  schema: chapterMetaSchema,
});

const chapterAnnotations = defineCollection({
  loader: glob({ pattern: "**/annotations.json", base: "./content/chapters" }),
  schema: chapterScopedMetadata.extend({
    license: z.literal("CC0-1.0"),
    items: z.array(z.record(z.string(), z.unknown())),
  }),
});

const chapterSources = defineCollection({
  loader: glob({ pattern: "**/source-links.json", base: "./content/chapters" }),
  schema: chapterScopedMetadata.extend({
    license: z.literal("CC0-1.0"),
    primarySources: z.array(z.record(z.string(), z.unknown())),
    companionSources: z.array(z.record(z.string(), z.unknown())),
  }),
});

const chapterWorld = defineCollection({
  loader: glob({ pattern: "**/world.json", base: "./content/chapters" }),
  schema: chapterScopedMetadata.extend({
    license: z.literal("CC0-1.0"),
    people: z.array(z.unknown()),
    concepts: z.array(z.unknown()),
    traditions: z.array(z.unknown()),
    places: z.array(z.unknown()),
  }),
});

const chapterRights = defineCollection({
  loader: glob({ pattern: "**/rights.json", base: "./content/chapters" }),
  schema: chapterScopedMetadata.extend({
    proseLicense: z.literal("CC-BY-4.0"),
    rightsRecordIds: z.array(z.string()),
    thirdPartyExceptions: z.array(z.string()),
  }),
});

const chapterReading = defineCollection({
  loader: glob({ pattern: "**/reading.json", base: "./content/chapters" }),
  schema: chapterScopedMetadata.extend({
    slug: z.string(),
    title: z.string(),
    language: z.literal("en"),
    sourceSha256: z.string().length(64),
    plainTextSha256: z.string().length(64),
    wordCount: z.number().int().positive(),
    readingMinutes: z.number().int().positive(),
    licenses: z.object({
      prosePayload: z.literal("CC-BY-4.0"),
      originalStructuralMetadata: z.literal("CC0-1.0"),
    }),
    audio: z.object({
      provider: z.null(),
      generated: z.literal(false),
      streamingReady: z.boolean(),
    }),
    segments: z.array(z.object({
      id: z.string(),
      type: z.string(),
      sectionId: z.string().nullable(),
      level: z.number().int().nullable(),
      text: z.string(),
    })),
  }),
});

const book = defineCollection({
  loader: glob({ pattern: "book.json", base: "./content" }),
  schema: z.object({
    schemaVersion: z.literal(1),
    id: z.string(),
    title: z.string(),
    subtitle: z.string(),
    language: z.literal("en"),
    edition: z.string(),
    chapterCount: z.literal(18),
    licensePolicy: z.string(),
    privacy: z.object({ studentAccounts: z.boolean(), studentDataStored: z.boolean() }),
    parts: z.array(z.object({
      id: z.string(),
      order: z.number().int().positive(),
      title: z.string(),
      slug: z.string(),
      chapters: z.array(z.object({
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        order: z.number().int().positive(),
        chapterOrder: z.number().int().positive(),
        path: z.string(),
      })),
    })),
  }),
});

export const collections = {
  book,
  chapters,
  chapterMeta,
  chapterAnnotations,
  chapterSources,
  chapterWorld,
  chapterRights,
  chapterReading,
};
