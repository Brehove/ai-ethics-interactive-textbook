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

const publicIdentifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const wikidataIdentifier = z.string().regex(/^Q[1-9][0-9]*$/);
const checksumSha256 = z.string().regex(/^[a-f0-9]{64}$/);
const chapterPersonRelationSchema = z.object({
  id: publicIdentifier,
  role: z.string().min(1),
  featured: z.boolean(),
  passageIds: z.array(publicIdentifier),
});

const chapterSourceRecordSchema = z.object({
  id: publicIdentifier,
  title: z.string().min(1),
  creator: z.string().min(1),
  authorPersonId: publicIdentifier.optional(),
  url: z.url(),
  locator: z.string().min(1).optional(),
  translation: z.string().min(1).optional(),
  excerpt: z.string().min(1).optional(),
  rightsStatus: z.string().min(1).optional(),
  rightsRecordId: publicIdentifier.optional(),
  passageIds: z.array(publicIdentifier),
  teachingUse: z.string().min(1),
});

export const personSchema = z.object({
  schemaVersion: z.literal(1),
  id: publicIdentifier,
  displayName: z.string().min(1),
  sortName: z.string().min(1),
  lifeDates: z.string().min(1),
  biography: z.string().min(1),
  teaching: z.object({
    whyThisPerson: z.string().min(1),
    traditionIds: z.array(publicIdentifier),
    conceptIds: z.array(publicIdentifier),
    primarySourceIds: z.array(publicIdentifier),
  }),
  portraitId: publicIdentifier.nullable(),
  links: z.object({
    sep: z.url().nullable(),
    iep: z.url().nullable(),
    other: z.array(z.object({ label: z.string().min(1), url: z.url() })),
  }),
});

export const mediaSchema = z.object({
  schemaVersion: z.literal(1),
  id: publicIdentifier,
  kind: z.literal("image"),
  title: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().nullable(),
  teachingUse: z.string().min(1),
  decorative: z.literal(false),
  artifactType: z.enum(["manuscript", "title-page", "document", "historical-object", "technical-diagram", "map", "photograph"]).optional(),
  placements: z.array(z.object({
    chapterId: publicIdentifier,
    passageIds: z.array(publicIdentifier).min(1),
  })).min(1).optional(),
  rightsReview: z.object({
    status: z.enum(["pending", "approved", "rejected"]),
    reviewedAt: z.string().nullable(),
    sourceRevisionId: z.number().int().positive().nullable(),
    notes: z.string().nullable(),
  }),
});

const entityReferenceSchema = z.object({ id: wikidataIdentifier, label: z.string().min(1) });
const wikidataTimeSchema = z.object({
  time: z.string(),
  precision: z.number().int(),
  calendarModel: z.string(),
});

export const personWikimediaSchema = z.object({
  schemaVersion: z.literal(1),
  id: publicIdentifier,
  wikidataId: wikidataIdentifier,
  label: z.string().min(1),
  description: z.string().nullable(),
  aliases: z.array(z.string()),
  facts: z.object({
    birthDates: z.array(wikidataTimeSchema),
    deathDates: z.array(wikidataTimeSchema),
    birthPlaces: z.array(entityReferenceSchema),
    deathPlaces: z.array(entityReferenceSchema),
    occupations: z.array(entityReferenceSchema),
    movements: z.array(entityReferenceSchema),
    countriesOfCitizenship: z.array(entityReferenceSchema),
    notableWorks: z.array(entityReferenceSchema),
  }),
  wikipedia: z.object({ title: z.string().min(1), url: z.url() }).nullable(),
  commonsImageClaim: z.string().nullable(),
  source: z.object({
    provider: z.literal("Wikidata"),
    entityUrl: z.url(),
    revisionId: z.number().int().positive(),
    modified: z.string(),
    checksumSha256,
    license: z.literal("CC0-1.0"),
    licenseUrl: z.literal("https://creativecommons.org/publicdomain/zero/1.0/"),
  }),
});

export const mediaWikimediaSchema = z.object({
  schemaVersion: z.literal(1),
  id: publicIdentifier,
  personId: publicIdentifier.optional(),
  artifactId: publicIdentifier.optional(),
  commonsTitle: z.string().startsWith("File:"),
  source: z.object({
    provider: z.literal("Wikimedia Commons"),
    pageId: z.number().int().positive(),
    pageUrl: z.url(),
    revisionId: z.number().int().positive(),
    revisionTimestamp: z.string(),
    checksumSha256,
    metadataLicense: z.literal("CC0-1.0"),
  }),
  original: z.object({
    url: z.url(),
    mime: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    bytes: z.number().int().positive(),
    sha1: z.string().regex(/^[a-f0-9]{40}$/),
  }),
  derivative: z.object({
    localPath: z.string().regex(/^\/media\/wikimedia\/[a-z0-9][a-z0-9._-]*\.webp$/),
    sourceUrl: z.url(),
    mime: z.literal("image/webp"),
    width: z.number().int().positive().max(720),
    height: z.number().int().positive(),
    bytes: z.number().int().positive().max(250_000),
    sha256: checksumSha256,
    modification: z.string().min(1),
  }),
  rights: z.object({
    licenseShortName: z.string().min(1),
    licenseUrl: z.url().nullable(),
    usageTerms: z.string().min(1),
    attributionRequired: z.boolean(),
    artist: z.string().min(1),
    credit: z.string().nullable(),
  }),
}).refine((record) => Boolean(record.personId) !== Boolean(record.artifactId), {
  message: "Generated Wikimedia media must name exactly one personId or artifactId",
});

export const wikimediaManifestSchema = z.object({
  schemaVersion: z.literal(2),
  language: z.literal("en"),
  people: z.array(z.object({
    id: publicIdentifier,
    wikidataId: wikidataIdentifier,
    portrait: z.object({
      id: publicIdentifier,
      commonsTitle: z.string().startsWith("File:"),
      downloadPath: z.string().regex(/^media\/wikimedia\/[a-z0-9][a-z0-9._-]*\.webp$/),
      width: z.number().int().min(320).max(720),
    }).nullable(),
  })),
  artifacts: z.array(z.object({
    id: publicIdentifier,
    commonsTitle: z.string().startsWith("File:"),
    downloadPath: z.string().regex(/^media\/wikimedia\/[a-z0-9][a-z0-9._-]*\.webp$/),
    width: z.number().int().min(320).max(720),
  })),
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
    primarySources: z.array(chapterSourceRecordSchema),
    companionSources: z.array(chapterSourceRecordSchema),
  }),
});

const chapterWorld = defineCollection({
  loader: glob({ pattern: "**/world.json", base: "./content/chapters" }),
  schema: chapterScopedMetadata.extend({
    license: z.literal("CC0-1.0"),
    people: z.array(chapterPersonRelationSchema),
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

const people = defineCollection({
  loader: glob({ pattern: "entities/people/records/*.json", base: "./content" }),
  schema: personSchema,
});

const peopleWikimedia = defineCollection({
  loader: glob({ pattern: "entities/people/wikimedia/*.json", base: "./content" }),
  schema: personWikimediaSchema,
});

const media = defineCollection({
  loader: glob({ pattern: "media/records/*.json", base: "./content" }),
  schema: mediaSchema,
});

const mediaWikimedia = defineCollection({
  loader: glob({ pattern: "media/wikimedia/*.json", base: "./content" }),
  schema: mediaWikimediaSchema,
});

const wikimediaManifest = defineCollection({
  loader: glob({ pattern: "entities/people/wikimedia-manifest.json", base: "./content" }),
  schema: wikimediaManifestSchema,
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
  people,
  peopleWikimedia,
  media,
  mediaWikimedia,
  wikimediaManifest,
};
