#!/usr/bin/env node

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSiteUrl = process.env.PUBLIC_SITE_URL?.trim() || "https://ethicsandai.your-digital-life.org";

function canonicalOrigin(siteUrl) {
  const url = new URL(siteUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Offline download canonical URL must use HTTP(S), received ${url.protocol}`);
  }
  return url.origin;
}

export function rewriteRootRelativeHrefs(html, siteUrl = defaultSiteUrl) {
  const origin = canonicalOrigin(siteUrl);
  return html.replace(/(^|\s)href=(["'])(\/(?!\/)[^"']*)\2/gim, (_match, prefix, quote, href) => (
    `${prefix}href=${quote}${origin}${href}${quote}`
  ));
}

export async function finalizeOfflineDownloads({ projectRoot = root, siteUrl = defaultSiteUrl } = {}) {
  const downloadsRoot = path.join(projectRoot, "dist", "downloads");
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
    const html = await readFile(source, "utf8");
    await rm(directory, { recursive: true });
    await writeFile(target, rewriteRootRelativeHrefs(html, siteUrl));
  }

  return entries.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const finalized = await finalizeOfflineDownloads();
  process.stdout.write(`Finalized ${finalized} self-contained chapter HTML downloads.\n`);
}
