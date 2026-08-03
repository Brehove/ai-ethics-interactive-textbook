import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { MediaError, processMediaJob } from "../../scripts/media/process-media.mjs";
import { callbackPayload, callbackSignature, validateEnvelope } from "../../scripts/media/media-job.mjs";

async function fixture(bytes, name = "safe.png") {
  const root = await mkdtemp(path.join(os.tmpdir(), "media-p0-")); const inbox = path.join(root, "inbox"); const output = path.join(root, "out");
  await mkdir(inbox); await mkdir(output); await writeFile(path.join(inbox, name), bytes); return { inbox, output, name, bytes };
}
const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } }).png().toBuffer();
async function rejects(promise, code) { await assert.rejects(promise, (error) => error instanceof MediaError && error.code === code); }

test("accepts a still image and emits a SHA-addressed immutable manifest", async () => {
  const f = await fixture(png); const manifest = await processMediaJob({ job: { basename: f.name }, inboxDir: f.inbox, outputDir: f.output });
  assert.equal(manifest.source.sha256, createHash("sha256").update(png).digest("hex")); assert.equal(manifest.technical.width, 1);
  assert.equal(JSON.parse(await readFile(path.join(f.output, "sha256", manifest.source.sha256, "manifest.json"))).publication.rightsReview, "required");
});
test("rejects path traversal, SVG, executables, and a PDF polyglot", async () => {
  const f = await fixture(png);
  await rejects(processMediaJob({ job: { basename: "../safe.png" }, inboxDir: f.inbox, outputDir: f.output }), "E_NAME_INVALID");
  const svg = await fixture(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>", "utf8"), "bad.svg");
  await rejects(processMediaJob({ job: { basename: svg.name }, inboxDir: svg.inbox, outputDir: svg.output }), "E_ACTIVE_CONTENT");
  const exe = await fixture(Buffer.from("MZ harmless", "ascii"), "bad.bin");
  await rejects(processMediaJob({ job: { basename: exe.name }, inboxDir: exe.inbox, outputDir: exe.output }), "E_ACTIVE_CONTENT");
  const poly = await fixture(Buffer.concat([png, Buffer.from("<svg", "ascii")]), "poly.png");
  await rejects(processMediaJob({ job: { basename: poly.name }, inboxDir: poly.inbox, outputDir: poly.output }), "E_ACTIVE_CONTENT");
  const pdf = await fixture(Buffer.from("%PDF-1.7\n/JavaScript (evil)", "ascii"), "bad.pdf");
  await rejects(processMediaJob({ job: { basename: pdf.name }, inboxDir: pdf.inbox, outputDir: pdf.output }), "E_PDF_UNSAFE");
});
test("rejects unsupported magic and refuses unexpected manifest fields", async () => {
  const f = await fixture(Buffer.from("not media"), "bad.dat");
  await rejects(processMediaJob({ job: { basename: f.name }, inboxDir: f.inbox, outputDir: f.output }), "E_MAGIC_UNSUPPORTED");
  await rejects(processMediaJob({ job: { basename: f.name, sourcePath: "/tmp/x" }, inboxDir: f.inbox, outputDir: f.output }), "E_JOB_INVALID");
});

const envelope = () => ({
  schemaVersion: 1, jobId: "media_job_00000001", basename: "safe.png",
  quarantineObjectKey: "quarantine/2026/08/safe.png", outputPrefix: "media/ethics-assets",
  expectedSource: { sha256: "a".repeat(64), bytes: 100, mimeType: "image/png", storageReservationBytes: 1024 * 1024 },
  callback: { url: "https://content-api.example.edu/v1/media/completions", tokenRef: "MEDIA_CALLBACK_TOKEN" },
  rights: { required: true, reviewId: "rights:123" }, editorial: { required: true, reviewId: "editorial:123" }, accessibility: { required: true, reviewId: "a11y:123" },
});
test("envelope permits only a reviewed R2-to-callback contract", () => {
  assert.equal(validateEnvelope(envelope()).quarantineObjectKey, "quarantine/2026/08/safe.png");
  const traversal = envelope(); traversal.outputPrefix = "media/../published";
  assert.throws(() => validateEnvelope(traversal), (error) => error.code === "E_ENVELOPE_INVALID");
  const badToken = envelope(); badToken.callback.tokenRef = "AN_ARBITRARY_SECRET";
  assert.throws(() => validateEnvelope(badToken), (error) => error.code === "E_ENVELOPE_INVALID");
});
test("completion payload is idempotent and HMAC signed without embedding its token", () => {
  const sourceHash = "a".repeat(64);
  const manifest = { immutableAddress: `sha256:${sourceHash}`, source: { sha256: sourceHash, bytes: 100, detectedMime: "image/png" }, publication: { state: "quarantined" } };
  const payload = callbackPayload(envelope(), manifest); const signature = callbackSignature(payload, "x".repeat(32));
  assert.equal(payload.idempotencyKey, `media:media_job_00000001:${sourceHash}`); assert.match(signature, /^sha256=[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(payload).includes("x".repeat(32)), false);
});
test("a production-required malware scanner fails closed when unavailable", async () => {
  const f = await fixture(png); const priorPath = process.env.PATH; const priorRequired = process.env.MEDIA_REQUIRE_MALWARE_SCAN;
  process.env.PATH = ""; process.env.MEDIA_REQUIRE_MALWARE_SCAN = "1";
  try { await rejects(processMediaJob({ job: { basename: f.name }, inboxDir: f.inbox, outputDir: f.output }), "E_SCANNER_UNAVAILABLE"); }
  finally { process.env.PATH = priorPath; if (priorRequired === undefined) delete process.env.MEDIA_REQUIRE_MALWARE_SCAN; else process.env.MEDIA_REQUIRE_MALWARE_SCAN = priorRequired; }
});
