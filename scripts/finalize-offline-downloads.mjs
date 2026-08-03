#!/usr/bin/env node

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSiteUrl = process.env.PUBLIC_SITE_URL?.trim() || "https://ethicsandai.your-digital-life.org";
const offlineMediaLimitBytes = 50 * 1024 * 1024;
const releaseMime = new Map([["png", "image/png"], ["jpg", "image/jpeg"], ["webp", "image/webp"], ["gif", "image/gif"], ["mp3", "audio/mpeg"], ["wav", "audio/wav"], ["m4a", "audio/mp4"], ["mp4", "video/mp4"], ["webm", "video/webm"], ["pdf", "application/pdf"], ["txt", "text/plain;charset=utf-8"]]);

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

export async function embedReleaseAssets(html, distRoot) {
  // A data URI contains a comma, which is also srcset's candidate delimiter.
  // Offline exports therefore keep the embedded full derivative as `src` and
  // remove only release-generated responsive candidates; the download remains
  // self-contained and never points at files outside the single HTML artifact.
  html = html.replace(/\s+srcset=(['"])[^'"]*\/release-assets\/[^'"]*\1/gim, "");
  let totalBytes = 0;
  const pattern = /(^|\s)(src|poster|href)=(["'])\/release-assets\/([a-f0-9]{64})\.([a-z0-9]+)\3/gim;
  const matches = [...html.matchAll(pattern)];
  const dataUris = new Map();
  for (const match of matches) {
    const [, , , , digest, extension] = match;
    const mimeType = releaseMime.get(extension.toLowerCase());
    if (!mimeType) throw new Error(`Offline release asset has unsupported extension: ${extension}`);
    const key = `${digest}.${extension.toLowerCase()}`;
    if (!dataUris.has(key)) {
      const bytes = await readFile(path.join(distRoot, "release-assets", key));
      totalBytes += bytes.length;
      if (totalBytes > offlineMediaLimitBytes) throw new Error(`Offline chapter release media exceeds ${offlineMediaLimitBytes} bytes`);
      dataUris.set(key, `data:${mimeType};base64,${bytes.toString("base64")}`);
    }
  }
  return html.replace(pattern, (_match, prefix, attribute, quote, digest, extension) => `${prefix}${attribute}=${quote}${dataUris.get(`${digest}.${extension.toLowerCase()}`)}${quote}`);
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
    const embedded = await embedReleaseAssets(html, path.join(projectRoot, "dist"));
    await writeFile(target, rewriteRootRelativeHrefs(embedded, siteUrl));
  }

  return entries.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const finalized = await finalizeOfflineDownloads();
  process.stdout.write(`Finalized ${finalized} self-contained chapter HTML downloads.\n`);
}
