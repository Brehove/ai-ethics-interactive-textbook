import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const result = {
    source: "origin/main",
    output: "docs/baseline/origin-main-manifest.json",
    signingKey: process.env.BASELINE_SIGNING_KEY ?? "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (name === "--source" && value) result.source = value;
    if (name === "--output" && value) result.output = value;
    if (name === "--signing-key" && value) result.signingKey = value;
    if (name.startsWith("--")) index += 1;
  }
  return result;
}

function git(args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding,
    maxBuffer: 128 * 1024 * 1024,
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceFile(source, filePath) {
  return git(["show", `${source}:${filePath}`], null);
}

function jsonAt(source, filePath) {
  return JSON.parse(sourceFile(source, filePath).toString("utf8"));
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const args = parseArgs(process.argv.slice(2));
const sourceRevision = git(["rev-parse", args.source]).trim();
const sourceCommittedAt = git(["show", "-s", "--format=%cI", sourceRevision]).trim();
const trackedPaths = git(["ls-tree", "-r", "--name-only", sourceRevision])
  .trim()
  .split("\n")
  .filter(Boolean)
  .sort();

const chapterDirs = trackedPaths
  .filter((filePath) => /^content\/chapters\/[^/]+\/meta\.json$/.test(filePath))
  .map((filePath) => path.dirname(filePath));
const book = jsonAt(sourceRevision, "content/book.json");
let sectionIds = 0;
let passageIds = 0;
let checkpoints = 0;
let checkpointAnchors = 0;

for (const chapterDir of chapterDirs) {
  const markdown = sourceFile(sourceRevision, `${chapterDir}/chapter.md`).toString("utf8");
  sectionIds += countMatches(markdown, /<!-- phil-section-id: [a-z0-9-]+ -->/g);
  passageIds += countMatches(markdown, /<!-- phil-passage-id: [a-z0-9-]+ -->/g);
  const readingRecord = jsonAt(sourceRevision, `${chapterDir}/reading-record.json`);
  checkpoints += readingRecord.checkpoints.length;
  checkpointAnchors += readingRecord.checkpoints.filter((checkpoint) => checkpoint.passageId).length;
}

const mediaRecords = trackedPaths.filter((filePath) => /^content\/media\/records\/[^/]+\.json$/.test(filePath));
const vendoredMedia = trackedPaths.filter((filePath) => /^public\/media\/wikimedia\//.test(filePath));
const fileHashes = trackedPaths.map((filePath) => {
  const bytes = sourceFile(sourceRevision, filePath);
  return {
    path: filePath,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  };
});

const planBytes = await readFile("docs/AGENT_NATIVE_AUTHORING_PLATFORM_IMPLEMENTATION_PLAN.md");
const manifestWithoutId = {
  schemaVersion: 1,
  kind: "phil123-origin-baseline",
  repository: "Brehove/ai-ethics-interactive-textbook",
  sourceRef: args.source,
  sourceRevision,
  sourceCommittedAt,
  planSha256: sha256(planBytes),
  invariants: {
    studentAccounts: false,
    studentDataStored: false,
    publicReaderUsesLiveContentApi: false,
    contentAuthority: "git",
  },
  counts: {
    parts: book.parts.length,
    chapters: chapterDirs.length,
    sectionIds,
    passageIds,
    checkpoints,
    checkpointAnchors,
    mediaRecords: mediaRecords.length,
    vendoredMediaFiles: vendoredMedia.length,
    trackedFiles: trackedPaths.length,
  },
  files: fileHashes,
};
const baselineId = `baseline_${sha256(stableJson(manifestWithoutId)).slice(0, 32)}`;
const manifest = { ...manifestWithoutId, baselineId };
const serialized = stableJson(manifest);
const outputPath = path.resolve(args.output);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, serialized, "utf8");

const digest = sha256(serialized);
await writeFile(`${outputPath}.sha256`, `${digest}  ${path.basename(outputPath)}\n`, "utf8");

if (args.signingKey) {
  const privateKey = createPrivateKey(await readFile(path.resolve(args.signingKey)));
  const signature = sign(null, Buffer.from(serialized), privateKey).toString("base64");
  const publicKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  await writeFile(`${outputPath}.sig`, `${signature}\n`, "utf8");
  await writeFile(`${outputPath}.pub.pem`, publicKey, "utf8");
}

console.log(JSON.stringify({ baselineId, digest, counts: manifest.counts, signed: Boolean(args.signingKey) }, null, 2));
