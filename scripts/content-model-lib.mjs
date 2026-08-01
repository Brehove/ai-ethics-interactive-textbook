import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const SECTION_MARKER = /^<!-- phil-section-id: ([a-z0-9-]+) -->$/;
export const PASSAGE_MARKER = /^<!-- phil-passage-id: ([a-z0-9-]+) -->$/;

const RAW_CONTAINER_TAGS = new Set([
  "aside",
  "blockquote",
  "details",
  "div",
  "dl",
  "figure",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

export function normalizeNewlines(value) {
  return value.replace(/\r\n?/g, "\n").replace(/\s+$/u, "") + "\n";
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, normalizeNewlines(value), "utf8");
}

export function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

export function applyTransformations(source, transformations, label = "source") {
  let result = source;
  for (const transformation of transformations) {
    if (transformation.kind !== "replace-exact") {
      throw new Error(`${label}: unsupported transformation ${transformation.kind}`);
    }
    const found = countOccurrences(result, transformation.from);
    if (found !== transformation.expectedOccurrences) {
      throw new Error(
        `${label}: expected ${transformation.expectedOccurrences} occurrence(s) for transformation, found ${found}`,
      );
    }
    result = result.split(transformation.from).join(transformation.to);
  }
  return result;
}

export function stripIdentityMarkers(markdown) {
  return normalizeNewlines(
    markdown
      .split(/\r?\n/)
      .filter((line) => !SECTION_MARKER.test(line) && !PASSAGE_MARKER.test(line))
      .join("\n"),
  );
}

function isFence(line) {
  const match = line.match(/^\s*(`{3,}|~{3,})/);
  return match?.[1] ?? null;
}

function isListStart(line) {
  return /^\s*(?:[-+*]|\d+[.)])\s+\S/.test(line);
}

function isHorizontalRule(line) {
  return /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line);
}

function rawHeading(line) {
  const match = line.match(/^\s*<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>\s*$/i);
  return match ? { level: Number(match[1]), text: match[2] } : null;
}

function markdownHeading(line) {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  return match ? { level: match[1].length, text: match[2] } : null;
}

function rawContainerTag(line) {
  const match = line.match(/^\s*<([a-z][a-z0-9-]*)\b/i);
  if (!match) return null;
  const tag = match[1].toLowerCase();
  return RAW_CONTAINER_TAGS.has(tag) ? tag : null;
}

function tagDelta(line, tag) {
  const open = [...line.matchAll(new RegExp(`<${tag}\\b`, "gi"))].length;
  const close = [...line.matchAll(new RegExp(`</${tag}>`, "gi"))].length;
  const selfClosing = [...line.matchAll(new RegExp(`<${tag}\\b[^>]*?/>`, "gi"))].length;
  return open - close - selfClosing;
}

function consumeRawContainer(lines, start, tag) {
  let depth = 0;
  for (let index = start; index < lines.length; index += 1) {
    depth += tagDelta(lines[index], tag);
    if (depth <= 0 && new RegExp(`</${tag}>`, "i").test(lines[index])) return index;
  }
  throw new Error(`Unclosed raw HTML <${tag}> block beginning on line ${start + 1}`);
}

function isMarkdownTableStart(lines, index) {
  if (!lines[index]?.includes("|") || index + 1 >= lines.length) return false;
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1]);
}

function beginsNewBlock(lines, index) {
  const line = lines[index] ?? "";
  if (!line.trim()) return true;
  if (markdownHeading(line) || rawHeading(line) || isFence(line) || rawContainerTag(line)) return true;
  if (isListStart(line) || /^\s*>/.test(line) || isHorizontalRule(line)) return true;
  return isMarkdownTableStart(lines, index);
}

export function tokenizeMarkdown(markdown) {
  const lines = normalizeNewlines(markdown).replace(/\n$/, "").split("\n");
  const tokens = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim() || SECTION_MARKER.test(line) || PASSAGE_MARKER.test(line)) {
      index += 1;
      continue;
    }

    const mdHeading = markdownHeading(line);
    const htmlHeading = rawHeading(line);
    if (mdHeading || htmlHeading) {
      const heading = mdHeading ?? htmlHeading;
      tokens.push({
        kind: heading.level === 1 ? "title" : "section",
        blockType: "heading",
        level: heading.level,
        start: index,
        end: index,
        raw: line,
      });
      index += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      index += 1;
      continue;
    }

    const fence = isFence(line);
    if (fence) {
      let end = index + 1;
      while (end < lines.length && !new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(lines[end])) end += 1;
      if (end >= lines.length) throw new Error(`Unclosed fenced block beginning on line ${index + 1}`);
      tokens.push({ kind: "passage", blockType: "code", start: index, end, raw: lines.slice(index, end + 1).join("\n") });
      index = end + 1;
      continue;
    }

    const containerTag = rawContainerTag(line);
    if (containerTag) {
      const end = consumeRawContainer(lines, index, containerTag);
      tokens.push({ kind: "passage", blockType: containerTag, start: index, end, raw: lines.slice(index, end + 1).join("\n") });
      index = end + 1;
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      let end = index + 2;
      while (end < lines.length && lines[end].trim() && lines[end].includes("|")) end += 1;
      tokens.push({ kind: "passage", blockType: "table", start: index, end: end - 1, raw: lines.slice(index, end).join("\n") });
      index = end;
      continue;
    }

    if (isListStart(line)) {
      let end = index + 1;
      while (end < lines.length) {
        if (lines[end].trim() === "") {
          const next = lines[end + 1] ?? "";
          if (isListStart(next) || /^\s{2,}\S/.test(next)) {
            end += 1;
            continue;
          }
          break;
        }
        if (!isListStart(lines[end]) && !/^\s{2,}\S/.test(lines[end])) break;
        end += 1;
      }
      tokens.push({ kind: "passage", blockType: "list", start: index, end: end - 1, raw: lines.slice(index, end).join("\n") });
      index = end;
      continue;
    }

    if (/^\s*>/.test(line)) {
      let end = index + 1;
      while (end < lines.length && (/^\s*>/.test(lines[end]) || !lines[end].trim())) end += 1;
      while (end > index + 1 && !lines[end - 1].trim()) end -= 1;
      tokens.push({ kind: "passage", blockType: "blockquote", start: index, end: end - 1, raw: lines.slice(index, end).join("\n") });
      index = end;
      continue;
    }

    let end = index + 1;
    while (end < lines.length && !beginsNewBlock(lines, end)) end += 1;
    tokens.push({ kind: "passage", blockType: "paragraph", start: index, end: end - 1, raw: lines.slice(index, end).join("\n") });
    index = end;
  }

  return { lines, tokens };
}

export function instrumentMarkdown(markdown, chapterId) {
  const clean = stripIdentityMarkers(markdown);
  const { lines, tokens } = tokenizeMarkdown(clean);
  const h1s = tokens.filter((token) => token.kind === "title");
  if (h1s.length !== 1 || tokens[0]?.kind !== "title") {
    throw new Error(`${chapterId}: chapter must contain exactly one leading H1`);
  }

  const insertions = new Map();
  let sectionNumber = 0;
  let passageNumber = 0;
  for (const token of tokens) {
    if (token.kind === "title") continue;
    if (token.kind === "section") {
      sectionNumber += 1;
      insertions.set(token.start, `<!-- phil-section-id: ${chapterId}-s${String(sectionNumber).padStart(3, "0")} -->`);
    } else {
      passageNumber += 1;
      insertions.set(token.start, `<!-- phil-passage-id: ${chapterId}-p${String(passageNumber).padStart(4, "0")} -->`);
    }
  }

  const output = [];
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    if (insertions.has(lineNumber)) output.push(insertions.get(lineNumber));
    output.push(lines[lineNumber]);
  }
  return normalizeNewlines(output.join("\n"));
}

export function synchronizeIdentityMarkers(markdown, chapterId) {
  const normalized = normalizeNewlines(markdown).replace(/\n$/, "");
  const originalLines = normalized.split("\n");
  const cleanLines = [];
  const originalToClean = new Map();
  const existingByCleanStart = new Map();
  const existingIds = new Set();
  let nextSectionNumber = 1;
  let nextPassageNumber = 1;

  for (let index = 0; index < originalLines.length; index += 1) {
    if (SECTION_MARKER.test(originalLines[index]) || PASSAGE_MARKER.test(originalLines[index])) continue;
    originalToClean.set(index, cleanLines.length);
    cleanLines.push(originalLines[index]);
  }

  for (let index = 0; index < originalLines.length; index += 1) {
    const sectionMatch = originalLines[index].match(SECTION_MARKER);
    const passageMatch = originalLines[index].match(PASSAGE_MARKER);
    if (!sectionMatch && !passageMatch) continue;
    const marker = { kind: sectionMatch ? "section" : "passage", id: (sectionMatch ?? passageMatch)[1] };
    if (existingIds.has(marker.id)) throw new Error(`${chapterId}: duplicate identity marker ${marker.id}`);
    existingIds.add(marker.id);
    const numeric = Number.parseInt(marker.id.match(/-(?:s|p)(\d+)$/)?.[1] ?? "0", 10);
    if (marker.kind === "section") nextSectionNumber = Math.max(nextSectionNumber, numeric + 1);
    else nextPassageNumber = Math.max(nextPassageNumber, numeric + 1);

    let target = index + 1;
    while (target < originalLines.length && !originalLines[target].trim()) target += 1;
    if (target >= originalLines.length) throw new Error(`${chapterId}: orphan identity marker ${marker.id}`);
    if (SECTION_MARKER.test(originalLines[target]) || PASSAGE_MARKER.test(originalLines[target])) {
      throw new Error(`${chapterId}: adjacent markers leave ${marker.id} without a block`);
    }
    const cleanStart = originalToClean.get(target);
    if (existingByCleanStart.has(cleanStart)) throw new Error(`${chapterId}: multiple markers target the same block`);
    existingByCleanStart.set(cleanStart, marker);
  }

  const clean = normalizeNewlines(cleanLines.join("\n"));
  const { lines, tokens } = tokenizeMarkdown(clean);
  const h1s = tokens.filter((token) => token.kind === "title");
  if (h1s.length !== 1 || tokens[0]?.kind !== "title") throw new Error(`${chapterId}: chapter must contain exactly one leading H1`);
  const tokenStarts = new Set(tokens.map((token) => token.start));
  for (const [cleanStart, marker] of existingByCleanStart) {
    if (!tokenStarts.has(cleanStart)) throw new Error(`${chapterId}: ${marker.id} is not placed at a semantic block boundary`);
  }

  const insertions = new Map();
  for (const token of tokens) {
    if (token.kind === "title") continue;
    let marker = existingByCleanStart.get(token.start);
    if (marker && marker.kind !== token.kind) {
      throw new Error(`${chapterId}: ${marker.id} is a ${marker.kind} marker attached to a ${token.kind}`);
    }
    if (!marker) {
      if (token.kind === "section") {
        let id;
        do {
          id = `${chapterId}-s${String(nextSectionNumber).padStart(3, "0")}`;
          nextSectionNumber += 1;
        } while (existingIds.has(id));
        marker = { kind: "section", id };
      } else {
        let id;
        do {
          id = `${chapterId}-p${String(nextPassageNumber).padStart(4, "0")}`;
          nextPassageNumber += 1;
        } while (existingIds.has(id));
        marker = { kind: "passage", id };
      }
      existingIds.add(marker.id);
    }
    insertions.set(token.start, `<!-- phil-${marker.kind}-id: ${marker.id} -->`);
  }

  const output = [];
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    if (insertions.has(lineNumber)) output.push(insertions.get(lineNumber));
    output.push(lines[lineNumber]);
  }
  return normalizeNewlines(output.join("\n"));
}

function decodeEntities(text) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
  };
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

export function markdownBlockToText(raw, blockType = "paragraph") {
  let text = raw;
  if (blockType === "code") {
    text = text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n?/, "").replace(/\n?\s*(`{3,}|~{3,})\s*$/, "");
  }
  text = text
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|dt|dd|h[1-6]|tr|caption|blockquote|aside|div|section|figure|details)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/^\s*\|?/gm, "")
    .replace(/\|\s*$/gm, "")
    .replace(/\s*\|\s*/g, "; ")
    .replace(/^\s*:?-{3,}:?(?:\s*;\s*:?-{3,}:?)*\s*$/gm, "")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/`([^`]+)`/g, "$1");
  return decodeEntities(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function extractLeadingTitle(markdown) {
  const clean = stripIdentityMarkers(markdown);
  const first = clean.split("\n").find((line) => line.trim());
  const match = first?.match(/^#\s+(.+?)\s*#*\s*$/);
  return match ? markdownBlockToText(match[1]) : null;
}

function markerSequence(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const section = line.match(SECTION_MARKER);
      if (section) return { kind: "section", id: section[1] };
      const passage = line.match(PASSAGE_MARKER);
      if (passage) return { kind: "passage", id: passage[1] };
      return null;
    })
    .filter(Boolean);
}

export function parseInstrumentedMarkdown(markdown, chapterId) {
  const markers = markerSequence(markdown);
  const clean = stripIdentityMarkers(markdown);
  const { tokens } = tokenizeMarkdown(clean);
  const titleTokens = tokens.filter((token) => token.kind === "title");
  const identityTokens = tokens.filter((token) => token.kind !== "title");
  const errors = [];

  if (titleTokens.length !== 1 || tokens[0]?.kind !== "title") errors.push("exactly one leading H1 is required");
  if (markers.length !== identityTokens.length) {
    errors.push(`expected ${identityTokens.length} identity markers, found ${markers.length}`);
  }

  const seen = new Set();
  for (let index = 0; index < Math.min(markers.length, identityTokens.length); index += 1) {
    const marker = markers[index];
    const token = identityTokens[index];
    if (marker.kind !== token.kind) errors.push(`marker ${marker.id} labels ${marker.kind}, but token ${index + 1} is ${token.kind}`);
    if (!marker.id.startsWith(`${chapterId}-`)) errors.push(`marker ${marker.id} does not belong to ${chapterId}`);
    if (seen.has(marker.id)) errors.push(`duplicate identity marker ${marker.id}`);
    seen.add(marker.id);
  }

  if (errors.length) throw new Error(`${chapterId}: ${errors.join("; ")}`);

  const title = markdownBlockToText(titleTokens[0].raw, "heading");
  const segments = [{ id: `${chapterId}-title`, type: "title", sectionId: null, level: 1, text: title }];
  let currentSectionId = null;
  let markerIndex = 0;
  for (const token of identityTokens) {
    const marker = markers[markerIndex];
    markerIndex += 1;
    const text = markdownBlockToText(token.raw, token.blockType);
    if (!text) throw new Error(`${chapterId}: ${marker.id} has no readable text`);
    if (token.kind === "section") {
      currentSectionId = marker.id;
      segments.push({ id: marker.id, type: "heading", sectionId: marker.id, level: token.level, text });
    } else {
      segments.push({ id: marker.id, type: token.blockType, sectionId: currentSectionId, level: null, text });
    }
  }
  return { title, segments };
}

export function countWords(text) {
  return (text.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

function descriptionFromSegments(segments) {
  const candidate = segments.find((segment) => segment.type !== "title" && segment.type !== "heading" && segment.text.length >= 80)
    ?? segments.find((segment) => segment.type !== "title" && segment.type !== "heading");
  const value = candidate?.text.replace(/\s+/g, " ").trim() ?? "";
  if (value.length <= 220) return value;
  const shortened = value.slice(0, 217);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, boundary > 150 ? boundary : 217).trim()}…`;
}

export function buildReadingArtifacts(markdown, chapter) {
  const { title, segments } = parseInstrumentedMarkdown(markdown, chapter.id);
  if (title !== chapter.title) throw new Error(`${chapter.id}: H1 "${title}" does not match "${chapter.title}"`);
  const plainText = normalizeNewlines(segments.map((segment) => segment.text).join("\n\n"));
  const wordCount = countWords(plainText);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 225));
  const sourceSha256 = sha256(normalizeNewlines(markdown));
  return {
    description: descriptionFromSegments(segments),
    plainText,
    reading: {
      schemaVersion: 1,
      chapterId: chapter.id,
      slug: chapter.slug,
      title: chapter.title,
      language: "en",
      sourceSha256,
      plainTextSha256: sha256(plainText),
      wordCount,
      readingMinutes,
      licenses: { prosePayload: "CC-BY-4.0", originalStructuralMetadata: "CC0-1.0" },
      audio: { provider: null, generated: false, streamingReady: true },
      segments,
    },
  };
}

export function chapterDirectoryName(chapter) {
  return `${String(chapter.order).padStart(2, "0")}-${chapter.slug}`;
}
