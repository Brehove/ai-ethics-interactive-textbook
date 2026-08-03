#!/usr/bin/env node
/**
 * P0 media quarantine processor.  This is deliberately a file processor, not
 * an upload endpoint: the caller supplies a reviewed inbox directory and a
 * small manifest containing only a basename.  No uploaded bytes are executed.
 */
import { createHash } from "node:crypto";
import { access, chmod, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const MiB = 1024 * 1024;
const DEFAULTS = { maxBytes: 25 * MiB, maxDurationSeconds: 300 };

export class MediaError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new MediaError(code, message); };

function safeBasename(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
    && value === path.basename(value) && !value.includes("..") && !value.startsWith(".");
}
function command(name, args) {
  const result = spawnSync(name, args, { encoding: "utf8", timeout: 30_000, windowsHide: true });
  if (result.error?.code === "ENOENT") return { available: false };
  if (result.error) fail("E_TOOL_FAILED", `${name} failed: ${result.error.message}`);
  return { available: true, ...result };
}
const SUPPORTED_MIME = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "audio/mpeg", "audio/wav", "audio/mp4",
  "video/mp4", "video/webm",
  "application/pdf", "text/plain",
]);
const ORIGINAL_EXTENSION = Object.freeze({
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a",
  "video/mp4": "mp4", "video/webm": "webm",
  "application/pdf": "pdf", "text/plain": "txt",
});

function isUtf8PlainText(bytes) {
  let decoded;
  try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return false; }
  if (!decoded || decoded.includes("\u0000")) return false;
  // Permit tabs and line endings, but not terminal/control payloads. Unicode
  // formatting remains intact and the derivative is always served as text.
  return !/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(decoded);
}

export function sniffMedia(bytes) {
  const head = bytes.subarray(0, 65_536);
  const text = head.toString("latin1").toLowerCase();
  const has = (needle) => text.includes(needle);
  if (has("<svg") || has("<!doctype svg")) fail("E_ACTIVE_CONTENT", "SVG is not accepted");
  if (head.subarray(0, 2).toString("ascii") === "MZ" || head.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
      (head.length >= 4 && [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe].includes(head.readUInt32BE(0)))) fail("E_ACTIVE_CONTENT", "executable header detected");
  if (head.subarray(0, 2).toString("ascii") === "#!") fail("E_ACTIVE_CONTENT", "script header detected");
  const magic = [];
  if (head.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) magic.push("image/png");
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) magic.push("image/jpeg");
  if (["GIF87a", "GIF89a"].includes(head.subarray(0, 6).toString("ascii"))) magic.push("image/gif");
  if (head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") magic.push("image/webp");
  if (head.subarray(0, 5).toString("ascii") === "%PDF-") magic.push("application/pdf");
  if (head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WAVE") magic.push("audio/wav");
  if (head.subarray(0, 3).toString("ascii") === "ID3" || (head.length >= 4 && head[0] === 0xff && (head[1] & 0xe6) === 0xe2)) magic.push("audio/mpeg");
  if (head.length >= 12 && head.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = head.subarray(8, 12).toString("ascii");
    if (["M4A ", "M4B ", "M4P "].includes(brand)) magic.push("audio/mp4");
    else if (["isom", "iso2", "mp41", "mp42", "avc1", "dash"].includes(brand)) magic.push("video/mp4");
    else fail("E_MAGIC_UNSUPPORTED", "ISO base-media brand is unsupported");
  }
  if (head.length >= 16 && head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && /webm/i.test(head.toString("latin1"))) magic.push("video/webm");
  if (magic.length === 0 && isUtf8PlainText(bytes)) magic.push("text/plain");
  if (magic.length !== 1) fail(magic.length ? "E_POLYGLOT" : "E_MAGIC_UNSUPPORTED", "file magic is unsupported or ambiguous");
  if (magic[0] === "application/pdf") {
    const pdfText = bytes.toString("latin1").toLowerCase();
    if (["/javascript", "/js", "/launch", "/embeddedfile", "/richmedia", "/acroform", "/openaction", "/aa"].some((token) => pdfText.includes(token))) {
      fail("E_PDF_UNSAFE", "active or embedded PDF feature detected");
    }
  }
  const conflicting = ["%pdf-", "<svg"].some((needle) => has(needle) && !((needle === "%pdf-") && magic[0] === "application/pdf"));
  if (conflicting) fail("E_POLYGLOT", "conflicting active-content signature detected");
  return magic[0];
}
function validateJob(job) {
  if (!job || typeof job !== "object" || Array.isArray(job) || Object.keys(job).some((key) => !["basename", "declaredMime", "captions", "poster", "rights", "editorial", "accessibility"].includes(key))) fail("E_JOB_INVALID", "job has unsupported fields");
  if (!safeBasename(job.basename)) fail("E_NAME_INVALID", "job.basename must be a sanitized basename");
  if (job.declaredMime !== undefined && !SUPPORTED_MIME.has(job.declaredMime)) fail("E_JOB_INVALID", "job.declaredMime is unsupported");
  if (job.captions !== undefined && (!job.captions || job.captions.provided !== true || typeof job.captions.language !== "string")) fail("E_JOB_INVALID", "captions must be a reviewed provided/language declaration");
  if (job.poster !== undefined && (!job.poster || job.poster.provided !== true || typeof job.poster.alt !== "string" || !job.poster.alt.trim())) fail("E_JOB_INVALID", "poster must be a reviewed provided/alt declaration");
  return job;
}
async function inspectImage(bytes, mime, destination) {
  let meta;
  try { meta = await sharp(bytes, { animated: true, limitInputPixels: 100_000_000 }).metadata(); }
  catch { fail("E_IMAGE_DECODE", "image decoder rejected the file"); }
  if (!meta.width || !meta.height) fail("E_IMAGE_DECODE", "image dimensions are unavailable");
  const animated = (meta.pages ?? 1) > 1;
  if (animated) {
    // Convert an animation as animation (not a raw GIF pass-through), plus a stable first-frame poster.
    await sharp(bytes, { animated: true, limitInputPixels: 100_000_000 }).webp({ quality: 82 }).toFile(path.join(destination, "animation.webp"));
    await sharp(bytes, { animated: true, pages: 1, limitInputPixels: 100_000_000 }).webp({ quality: 82 }).toFile(path.join(destination, "poster.webp"));
  } else await sharp(bytes, { limitInputPixels: 100_000_000 }).webp({ quality: 84 }).toFile(path.join(destination, "display.webp"));
  return { width: meta.width, height: meta.height, animated, frames: meta.pages ?? 1, derivative: animated ? "animation.webp" : "display.webp", poster: animated ? "poster.webp" : null, mime };
}
function probeMedia(source, mime, job, maxDurationSeconds, destination) {
  if (!job.captions) fail("E_CAPTIONS_REQUIRED", "audio and video require a reviewed captions/transcript declaration");
  if (mime.startsWith("video/") && !job.poster) fail("E_POSTER_REQUIRED", "video requires a reviewed poster declaration with alt text");
  const probe = command("ffprobe", ["-v", "error", "-show_entries", "format=duration:format=format_name", "-of", "json", source]);
  if (!probe.available) fail("E_TOOL_UNAVAILABLE", "ffprobe is required for audio/video");
  if (probe.status !== 0) fail("E_MEDIA_PROBE", "ffprobe rejected the media");
  let data; try { data = JSON.parse(probe.stdout); } catch { fail("E_MEDIA_PROBE", "ffprobe returned invalid metadata"); }
  const duration = Number(data?.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > maxDurationSeconds) fail("E_MEDIA_DURATION", `media duration must be 0-${maxDurationSeconds} seconds`);
  if (mime.startsWith("video/")) {
    const poster = command("ffmpeg", ["-nostdin", "-v", "error", "-i", source, "-frames:v", "1", "-vf", "scale=min(1600\\,iw):-2", "-y", path.join(destination, "poster.webp")]);
    if (!poster.available) fail("E_TOOL_UNAVAILABLE", "ffmpeg is required for video poster extraction");
    if (poster.status !== 0) fail("E_MEDIA_PROBE", "ffmpeg could not extract a safe video poster");
    const transcode = command("ffmpeg", ["-nostdin", "-v", "error", "-i", source, "-map_metadata", "-1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", "-y", path.join(destination, "display.mp4")]);
    if (!transcode.available || transcode.status !== 0) fail("E_MEDIA_TRANSCODE", "ffmpeg could not produce the clean video derivative");
  } else {
    const transcode = command("ffmpeg", ["-nostdin", "-v", "error", "-i", source, "-map_metadata", "-1", "-vn", "-c:a", "aac", "-movflags", "+faststart", "-y", path.join(destination, "audio.m4a")]);
    if (!transcode.available || transcode.status !== 0) fail("E_MEDIA_TRANSCODE", "ffmpeg could not produce the clean audio derivative");
  }
  return { mime, durationSeconds: duration, format: data.format.format_name, derivative: mime.startsWith("video/") ? "display.mp4" : "audio.m4a", captions: { state: "declared-review-required", language: job.captions.language }, poster: mime.startsWith("video/") ? { file: "poster.webp", state: "generated-review-required", alt: job.poster.alt } : "not-applicable" };
}
function disarmPdf(source, destination) {
  const qpdf = command("qpdf", ["--check", source]);
  if (!qpdf.available) fail("E_PDF_TOOL_UNAVAILABLE", "qpdf is required for PDF inspection/disarm");
  if (qpdf.status !== 0) fail("E_PDF_UNSAFE", "qpdf validation failed");
  const mutool = command("mutool", ["info", source]);
  if (!mutool.available) fail("E_PDF_TOOL_UNAVAILABLE", "mutool is required for PDF accessibility inspection");
  if (mutool.status !== 0) fail("E_PDF_UNSAFE", "mutool rejected the PDF");
  const output = path.join(destination, "disarmed.pdf");
  const rewrite = command("qpdf", ["--qdf", "--object-streams=disable", source, output]);
  if (rewrite.status !== 0) fail("E_PDF_UNSAFE", "qpdf could not produce a disarmed PDF");
  return { mime: "application/pdf", scan: "qpdf-check-passed", disarm: "qpdf-qdf-object-streams-disabled", accessibility: "manual-review-required", output: "disarmed.pdf" };
}
async function normalizeText(bytes, destination) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { fail("E_TEXT_ENCODING", "plain text must be valid UTF-8"); }
  if (text.includes("\u0000") || /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) fail("E_TEXT_CONTROL", "plain text contains unsupported control characters");
  const normalized = text.replace(/\r\n?/g, "\n");
  await writeFile(path.join(destination, "display.txt"), normalized, { encoding: "utf8", mode: 0o444 });
  return { mime: "text/plain", encoding: "utf-8", derivative: "display.txt", characters: [...normalized].length, lines: normalized.length ? normalized.split("\n").length : 0 };
}
async function maybeScan(source) {
  const database = process.env.MEDIA_CLAMAV_DB_DIR;
  const result = command(database ? "clamscan" : "clamdscan", database ? ["--no-summary", "--database", database, source] : ["--no-summary", source]);
  if (!result.available) {
    if (process.env.MEDIA_REQUIRE_MALWARE_SCAN === "1") fail("E_SCANNER_UNAVAILABLE", "required ClamAV scanner is unavailable; leave the object quarantined");
    return { state: "unavailable-manual-review-required" };
  }
  if (result.status !== 0) fail("E_MALWARE_SCAN", "clamdscan did not clear the file");
  return { state: "cleared" };
}

export async function processMediaJob({ job, inboxDir, outputDir, limits = {} }) {
  validateJob(job);
  if (!path.isAbsolute(inboxDir) || !path.isAbsolute(outputDir)) fail("E_JOB_INVALID", "inboxDir and outputDir must be absolute trusted configuration paths");
  const source = path.join(inboxDir, job.basename);
  try { await access(source); } catch { fail("E_SOURCE_MISSING", "inbox file is missing"); }
  const info = await stat(source); if (!info.isFile()) fail("E_SOURCE_MISSING", "inbox target is not a regular file");
  const maxBytes = limits.maxBytes ?? DEFAULTS.maxBytes; if (info.size > maxBytes || info.size === 0) fail("E_SIZE_LIMIT", `file must be 1-${maxBytes} bytes`);
  const bytes = await readFile(source); const sha256 = createHash("sha256").update(bytes).digest("hex"); const mime = sniffMedia(bytes);
  if (job.declaredMime && job.declaredMime !== mime) fail("E_MIME_MISMATCH", `declared MIME ${job.declaredMime} does not match detected ${mime}`);
  const destination = path.join(outputDir, "sha256", sha256);
  await mkdir(destination, { recursive: true });
  const existing = path.join(destination, "manifest.json");
  try { return JSON.parse(await readFile(existing, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  // Persist the exact bytes hashed above, never a second read of a mutable inbox path.
  const stagedSource = path.join(destination, "source");
  await writeFile(stagedSource, bytes, { mode: 0o444 });
  const scan = await maybeScan(stagedSource);
  let technical;
  if (mime.startsWith("image/")) technical = await inspectImage(bytes, mime, destination);
  else if (mime === "application/pdf") technical = disarmPdf(stagedSource, destination);
  else if (mime === "text/plain") technical = await normalizeText(bytes, destination);
  else technical = probeMedia(stagedSource, mime, job, limits.maxDurationSeconds ?? DEFAULTS.maxDurationSeconds, destination);
  const originalName = `original.${ORIGINAL_EXTENSION[mime]}`;
  await rename(stagedSource, path.join(destination, originalName));
  technical = { ...technical, original: { file: originalName, private: true, sha256, bytes: bytes.length } };
  let outputBytes = 0;
  for (const entry of await readdir(destination, { withFileTypes: true })) if (entry.isFile()) outputBytes += (await stat(path.join(destination, entry.name))).size;
  if (limits.maxOutputBytes && outputBytes + 1024 * 1024 > limits.maxOutputBytes) fail("E_STORAGE_RESERVATION", "source, derivatives, and manifest exceed the immutable job storage reservation");
  const manifest = { schemaVersion: 1, immutableAddress: `sha256:${sha256}`, source: { basename: job.basename, bytes: bytes.length, sha256, detectedMime: mime }, malwareScan: scan, technical, publication: { state: "quarantined", rightsReview: "required", editorialReview: "required", accessibilityReview: mime === "application/pdf" ? "required" : (mime.startsWith("audio/") || mime.startsWith("video/") ? "captions/transcript-required" : "alt-text-required") }, reviewRequirements: job.rights && job.editorial && job.accessibility ? { rights: job.rights, editorial: job.editorial, accessibility: job.accessibility } : undefined };
  const temporary = path.join(destination, `.manifest-${process.pid}.json`);
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o444 });
  await rename(temporary, existing);
  // Hash-addressed output is append-only: successful jobs leave a read-only directory.
  await chmod(destination, 0o555);
  return manifest;
}

async function cli() {
  const [flag, jobFile] = process.argv.slice(2);
  if (flag !== "--job" || !jobFile || process.argv.length !== 4) fail("E_JOB_INVALID", "usage: process-media.mjs --job <manifest.json>");
  const { readEnvelope } = await import("./media-job.mjs");
  const envelope = await readEnvelope(jobFile);
  const job = { basename: envelope.basename, declaredMime: envelope.expectedSource.mimeType, captions: envelope.captions, poster: envelope.poster, rights: envelope.rights, editorial: envelope.editorial, accessibility: envelope.accessibility };
  const inboxDir = process.env.MEDIA_INBOX_DIR; const outputDir = process.env.MEDIA_OUTPUT_DIR;
  if (!inboxDir || !outputDir) fail("E_JOB_INVALID", "MEDIA_INBOX_DIR and MEDIA_OUTPUT_DIR are required trusted configuration");
  process.stdout.write(`${JSON.stringify(await processMediaJob({ job, inboxDir, outputDir, limits: { maxBytes: envelope.expectedSource.bytes, maxOutputBytes: envelope.expectedSource.storageReservationBytes } }))}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) cli().catch((error) => { process.stderr.write(`${error.code ?? "E_INTERNAL"}: ${error.message}\n`); process.exitCode = 1; });
