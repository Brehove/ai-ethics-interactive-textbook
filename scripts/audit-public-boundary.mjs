#!/usr/bin/env node

import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", ".astro", "dist", "node_modules"]);
const privatePathPattern = new RegExp(`(?:/${"Users"}/|/${"home"}/[^/\s]+/|file:\\/\\/)`, "i");
const secretPatterns = [
  /-----BEGIN ((?:RSA |EC |OPENSSH )?PRIVATE KEY)-----\r?\n(?:[A-Za-z0-9+/=]{40,}\r?\n){2,}-----END \1-----/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~-]{24,}\b/i,
  /\b(?:api[_-]?token|api[_-]?key|client[_-]?secret)\s*[:=]\s*["'][^"']{12,}["']/i,
];
const forbiddenNames = [/\.stewardship\.ya?ml$/i, /\.provenance\.ya?ml$/i, /\.mdreview$/i, /^SOURCE_OF_TRUTH\.md$/i];

async function walk(directory, files, failures) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(root, fullPath);
    const stat = await lstat(fullPath);
    if (stat.isSymbolicLink()) {
      failures.push(`${relative}: symlink is not allowed in the public repository`);
      continue;
    }
    if (entry.isDirectory()) await walk(fullPath, files, failures);
    else if (entry.isFile()) files.push({ fullPath, relative });
  }
}

async function main() {
  const files = [];
  const failures = [];
  await walk(root, files, failures);
  for (const file of files) {
    if (forbiddenNames.some((pattern) => pattern.test(path.basename(file.relative)))) failures.push(`${file.relative}: private production sidecar/name`);
    const buffer = await readFile(file.fullPath);
    if (buffer.includes(0)) continue;
    const text = buffer.toString("utf8");
    if (privatePathPattern.test(text)) failures.push(`${file.relative}: private/local filesystem path`);
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) failures.push(`${file.relative}: probable secret material`);
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(`Public-boundary audit passed: ${files.length} files, no symlinks, private paths, production sidecars, or probable secrets.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
