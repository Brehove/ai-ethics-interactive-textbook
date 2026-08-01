#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractLeadingTitle, readJson, stripIdentityMarkers } from "./content-model-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function matches(source, expression) {
  return [...source.matchAll(expression)];
}

async function main() {
  const chaptersRoot = path.join(root, "content", "chapters");
  const directories = (await readdir(chaptersRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const failures = [];
  let tables = 0;
  let asides = 0;

  for (const directory of directories) {
    const [markdown, meta] = await Promise.all([
      readFile(path.join(chaptersRoot, directory, "chapter.md"), "utf8"),
      readJson(path.join(chaptersRoot, directory, "meta.json")),
    ]);
    const prepared = stripIdentityMarkers(markdown);
    const h1s = matches(prepared, /^#\s+.+$/gm);
    if (h1s.length !== 1 || extractLeadingTitle(prepared) !== meta.title) failures.push(`${meta.id}: requires one leading H1 matching meta.title`);
    if (/^---\s*$/m.test(prepared.slice(0, 500))) failures.push(`${meta.id}: YAML frontmatter is not allowed in chapter prose`);
    if (/<!-- phil-(?:section|passage)-id:/.test(prepared)) failures.push(`${meta.id}: identity marker leaked into prepared source`);
    if (/<(?:script|style|form)\b/i.test(prepared)) failures.push(`${meta.id}: forbidden deployment HTML element`);
    if (/(?:file:\/\/|\.\.\/)/i.test(prepared)) failures.push(`${meta.id}: local or parent-directory link`);
    if (meta.pressbooks.sourceFormat !== "gfm+raw-html" || meta.pressbooks.compatible !== true) failures.push(`${meta.id}: compatibility metadata missing`);
    if (meta.pressbooks.validated !== false || meta.pressbooks.publishAuthorized !== false) failures.push(`${meta.id}: website import must not claim Pressbooks validation or authorization`);

    const ids = matches(prepared, /\bid="([^"]+)"/g).map((match) => match[1]);
    if (new Set(ids).size !== ids.length) failures.push(`${meta.id}: duplicate raw HTML id`);
    const idSet = new Set(ids);
    for (const match of matches(prepared, /\baria-labelledby="([^"]+)"/g)) {
      if (!idSet.has(match[1])) failures.push(`${meta.id}: aria-labelledby points to missing ${match[1]}`);
    }

    const chapterTables = matches(prepared, /<table\b[^>]*>[\s\S]*?<\/table>/gi);
    tables += chapterTables.length;
    for (const [index, match] of chapterTables.entries()) {
      const table = match[0];
      if (!/<caption\b[^>]*>[\s\S]+?<\/caption>/i.test(table)) failures.push(`${meta.id}: table ${index + 1} lacks caption`);
      if (!/<thead\b/i.test(table) || !/<tbody\b/i.test(table)) failures.push(`${meta.id}: table ${index + 1} lacks thead/tbody`);
      if (!/<th\b[^>]*scope="col"/i.test(table)) failures.push(`${meta.id}: table ${index + 1} lacks column scope`);
      if (!/<th\b[^>]*scope="row"/i.test(table)) failures.push(`${meta.id}: table ${index + 1} lacks row scope`);
    }
    const chapterAsides = matches(prepared, /<aside\b[^>]*>[\s\S]*?<\/aside>/gi);
    asides += chapterAsides.length;
    for (const [index, match] of chapterAsides.entries()) {
      const aside = match[0];
      const label = aside.match(/aria-labelledby="([^"]+)"/)?.[1];
      if (!label || !new RegExp(`\\bid="${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(aside)) {
        failures.push(`${meta.id}: aside ${index + 1} lacks an internal accessible label target`);
      }
    }
  }
  if (directories.length !== 18) failures.push(`expected 18 chapters, found ${directories.length}`);
  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(`Pressbooks compatibility gate passed: ${directories.length} marker-free preparations, ${asides} accessible asides, ${tables} accessible raw tables. This is not publication validation or authorization.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
