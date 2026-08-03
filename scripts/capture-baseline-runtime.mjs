import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const localOrigin = process.env.BASELINE_LOCAL_ORIGIN ?? "http://127.0.0.1:4325";
const productionOrigin = "https://ethicsandai.your-digital-life.org";
const outputDir = path.resolve(process.env.BASELINE_OUTPUT_DIR ?? "docs/baseline/runtime");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const pages = [
  { id: "home", path: "/" },
  { id: "chapter-07", path: "/chapter/aristotle-character-and-ai-assisted-life/" },
  { id: "admin", path: "/admin/" },
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function selectedHeaders(headers) {
  const names = [
    "cache-control",
    "content-security-policy",
    "content-type",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "permissions-policy",
    "referrer-policy",
    "server",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
  ];
  return Object.fromEntries(names.flatMap((name) => {
    const value = headers.get(name);
    return value ? [[name, value]] : [];
  }));
}

async function inspect(origin, page) {
  const response = await fetch(`${origin}${page.path}`, { redirect: "manual" });
  const body = await response.text();
  return {
    id: page.id,
    url: `${origin}${page.path}`,
    status: response.status,
    headers: selectedHeaders(response.headers),
    bytes: Buffer.byteLength(body),
    sha256: sha256(body),
    inlineScripts: (body.match(/<script(?:\s|>)/gi) ?? []).length,
    inlineStyles: (body.match(/<style(?:\s|>)/gi) ?? []).length,
    storageReferences: (body.match(/\b(?:localStorage|sessionStorage|indexedDB)\b/g) ?? []).length,
  };
}

async function screenshot(page, name, width, height, extra = []) {
  const target = path.join(outputDir, `${name}.png`);
  await execFileAsync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=2500",
    `--window-size=${width},${height}`,
    `--screenshot=${target}`,
    ...extra,
    `${localOrigin}${page.path}`,
  ]);
  const bytes = await readFile(target);
  return { file: path.relative(process.cwd(), target), width, height, bytes: bytes.byteLength, sha256: sha256(bytes) };
}

await mkdir(outputDir, { recursive: true });
const local = [];
const production = [];
for (const page of pages) {
  local.push(await inspect(localOrigin, page));
  production.push(await inspect(productionOrigin, page));
}

const screenshots = [
  await screenshot(pages[0], "home-desktop-1536x1024", 1536, 1024),
  await screenshot(pages[1], "chapter-07-desktop-1536x1024", 1536, 1024),
  await screenshot(pages[1], "chapter-07-mobile-390x844", 390, 844, [
    "--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  ]),
  await screenshot(pages[1], "chapter-07-no-js-1536x1024", 1536, 1024, ["--disable-javascript"]),
  await screenshot(pages[2], "admin-desktop-1536x1024", 1536, 1024),
];

const printPath = path.join(outputDir, "chapter-07-print.pdf");
await execFileAsync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf=${printPath}`,
  `${localOrigin}${pages[1].path}`,
]);
const printBytes = await readFile(printPath);

const snapshot = {
  schemaVersion: 1,
  sourceRevision: "0a2716182953f492a654aa8b704d420216f39450",
  localOrigin,
  productionOrigin,
  local,
  production,
  screenshots,
  print: {
    file: path.relative(process.cwd(), printPath),
    bytes: printBytes.byteLength,
    sha256: sha256(printBytes),
  },
  observations: {
    studentStorageAllowed: false,
    providerRequestsExpectedBeforeActivation: 0,
    browserToolFallback: "Chrome headless used because the in-app Browser and js_repl Playwright tools were unavailable",
  },
};
await writeFile(path.join(outputDir, "runtime-snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ pages: local.length, screenshots: screenshots.length, outputDir }, null, 2));
