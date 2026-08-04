import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "workers/editor-auth/src/chapter-route-manifest.mjs");
const clientManifestPath = resolve(root, "apps/instructor-editor/src/chapter-route-manifest.ts");
const book = JSON.parse(await readFile(resolve(root, "content/book.json"), "utf8"));
const chapters = book.parts.flatMap((part) => part.chapters ?? []);

if (chapters.length !== 18 || new Set(chapters.map((chapter) => chapter.slug)).size !== 18) {
  throw new Error("Expected exactly 18 canonical chapters with unique slugs");
}

const entries = chapters.map((chapter) => {
  if (!/^ch(?:0[1-9]|1[0-8])$/.test(chapter.id ?? "") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapter.slug ?? "") || chapter.path !== `/chapter/${chapter.slug}/`) {
    throw new Error(`Invalid canonical chapter route: ${JSON.stringify(chapter)}`);
  }
  return `  ["chapter_${chapter.id}", "${chapter.slug}"],`;
}).join("\n");

const generated = `// Generated from content/book.json by scripts/generate-editor-chapter-manifest.mjs.
// This deliberately contains routing metadata only; it is safe to bundle in the
// auth Worker and is the sole allowlist for OAuth editor-return targets.
export const CHAPTER_ROUTE_MANIFEST = Object.freeze([
${entries}
].map(([documentId, slug]) => Object.freeze({
  documentId,
  slug,
  publicPath: \`/chapter/\${slug}/\`,
  editorPath: \`/chapter/\${slug}/\`,
})));

export const CHAPTER_ROUTE_BY_SLUG = new Map(CHAPTER_ROUTE_MANIFEST.map((route) => [route.slug, route]));
`;

const clientGenerated = `// Generated from content/book.json by scripts/generate-editor-chapter-manifest.mjs.
// Routing metadata only. Keep this client allowlist identical to the auth Worker.
export const CHAPTER_ROUTE_MANIFEST = Object.freeze([
${entries}
].map(([documentId, slug]) => Object.freeze({ documentId, slug })));

export const CHAPTER_ROUTE_BY_SLUG = new Map(CHAPTER_ROUTE_MANIFEST.map((route) => [route.slug, route]));
`;

if (process.argv.includes("--check")) {
  const actual = await readFile(manifestPath, "utf8");
  if (actual !== generated) throw new Error("workers/editor-auth/src/chapter-route-manifest.mjs is stale; run this script with --write");
  const clientActual = await readFile(clientManifestPath, "utf8");
  if (clientActual !== clientGenerated) throw new Error("apps/instructor-editor/src/chapter-route-manifest.ts is stale; run this script with --write");
  process.stdout.write("Editor chapter-route manifest is current (18 routes).\n");
} else if (process.argv.includes("--write")) {
  await writeFile(manifestPath, generated, "utf8");
  await writeFile(clientManifestPath, clientGenerated, "utf8");
  process.stdout.write("Wrote auth and editor chapter-route manifests (18 routes).\n");
} else {
  process.stdout.write(generated);
}
