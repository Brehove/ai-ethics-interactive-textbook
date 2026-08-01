import {
  getPerson,
  type ChapterWorld,
  type PersonBundle,
} from "./content";

export interface ChapterPersonRelation {
  id: string;
  role: string;
  featured: boolean;
  passageIds: string[];
}

export interface ResolvedChapterPerson {
  relation: ChapterPersonRelation;
  person: PersonBundle;
}

function normalizePersonRelation(value: unknown): ChapterPersonRelation | null {
  if (typeof value === "string") {
    return { id: value, role: "", featured: false, passageIds: [] };
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) return null;

  return {
    id: record.id,
    // `summary` is accepted temporarily so earlier chapter metadata keeps a
    // useful no-JavaScript fallback while records move to the locked contract.
    role: typeof record.role === "string"
      ? record.role
      : typeof record.summary === "string"
        ? record.summary
        : "",
    featured: record.featured === true,
    passageIds: Array.isArray(record.passageIds)
      ? record.passageIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export async function resolveChapterPeople(world: ChapterWorld): Promise<ResolvedChapterPerson[]> {
  const references = Array.isArray(world.people)
    ? world.people.map(normalizePersonRelation).filter((item): item is ChapterPersonRelation => item !== null)
    : [];

  return Promise.all(references.map(async (relation) => {
    const person = await getPerson(relation.id);
    if (!person) {
      throw new Error(`Chapter ${world.chapterId} references unknown person ${relation.id}`);
    }
    return { relation, person };
  }));
}

export function orderChapterPeople(people: ResolvedChapterPerson[]): ResolvedChapterPerson[] {
  const featured = people.filter(({ relation }) => relation.featured);
  const supporting = people.filter(({ relation }) => !relation.featured);
  return [...featured, ...supporting];
}
