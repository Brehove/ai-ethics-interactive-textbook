#!/usr/bin/env node

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const downloadsRoot = path.join(root, "dist", "downloads");
const entries = (await readdir(downloadsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name.endsWith(".html"))
  .sort((left, right) => left.name.localeCompare(right.name));

if (entries.length !== 18) {
  throw new Error(`Expected 18 generated offline chapter directories; found ${entries.length}`);
}

for (const entry of entries) {
  const directory = path.join(downloadsRoot, entry.name);
  const source = path.join(directory, "index.html");
  const target = path.join(downloadsRoot, entry.name);
  const html = await readFile(source);
  await rm(directory, { recursive: true });
  await writeFile(target, html);
}

process.stdout.write(`Finalized ${entries.length} self-contained chapter HTML downloads.\n`);
