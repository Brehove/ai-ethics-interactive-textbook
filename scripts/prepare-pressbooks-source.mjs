#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { extractLeadingTitle, normalizeNewlines, stripIdentityMarkers } from "./content-model-lib.mjs";

function parseArguments(argv) {
  const options = { chapter: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--chapter") options.chapter = path.resolve(argv[++index]);
    else if (argv[index] === "--output") options.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!options.chapter) throw new Error("--chapter <chapter.md> is required");
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const source = await readFile(options.chapter, "utf8");
  const prepared = normalizeNewlines(stripIdentityMarkers(source));
  if (!extractLeadingTitle(prepared)) throw new Error("Prepared Pressbooks source does not begin with one Markdown H1");
  if (options.output) {
    if (path.resolve(options.output) === path.resolve(options.chapter)) throw new Error("Refusing to overwrite canonical chapter.md");
    await writeFile(options.output, prepared, "utf8");
    process.stdout.write(`Prepared marker-free Pressbooks source at ${options.output}. No validation or publication authorization was granted.\n`);
  } else {
    process.stdout.write(prepared);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
