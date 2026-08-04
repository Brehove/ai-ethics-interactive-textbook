import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { optionValue } from "./argv.mjs";
import { extractMetaCsp } from "./csp.mjs";
const args = process.argv.slice(2); const value = (name) => optionValue(args, name);
const base = value("--base-url")?.replace(/\/$/, ""); const digestFile = value("--asset-digests"); const candidateFile = value("--candidate");
const ASSET_PROPAGATION_ATTEMPTS = 45;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
if (!base) throw new Error("usage: smoke.mjs --base-url <preview> [--candidate <file>] [--asset-digests <file>]");
const requiredRoutes = ["/"];
if (candidateFile) {
  const candidate = JSON.parse(await readFile(candidateFile, "utf8"));
  const chapters = candidate?.releaseSnapshot?.chapters;
  if (!Array.isArray(chapters) || chapters.length !== 18) throw new Error("Release smoke requires the signed complete 18-chapter candidate.");
  const slugs = chapters.map((chapter) => chapter?.slug);
  if (slugs.some((slug) => typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) || new Set(slugs).size !== 18) throw new Error("Release smoke candidate contains invalid or duplicate chapter slugs.");
  requiredRoutes.push(...slugs.map((slug) => `/chapter/${slug}/`));
} else {
  // Rollback verification has no candidate artifact; keep one known dynamic
  // chapter route in addition to the home-page smoke.
  requiredRoutes.push("/chapter/aristotle-character-and-ai-assisted-life/");
}
const routeResults = [];
for (const route of requiredRoutes) {
  const response = await fetch(`${base}${route}`, { headers: { "user-agent": "release-smoke/no-js" } });
  if (!response.ok) throw new Error(`Smoke route failed: ${route} (${response.status})`);
  const html = await response.text();
  if (!/<main[\s>]/i.test(html) || !/<h1[\s>]/i.test(html)) throw new Error(`No-JS reader gate failed: ${route} lacks server-rendered main content`);
  const responseCsp = response.headers.get("content-security-policy") ?? "";
  const metaCsp = extractMetaCsp(html);
  const csp = `${responseCsp};${metaCsp}`;
  if (!/default-src\s+'self'/.test(csp) || !/object-src\s+'none'/.test(csp)) throw new Error(`Smoke CSP gate failed: ${route}`);
  routeResults.push({ route, status: response.status, main: true, heading: true, csp: true });
}
const digestBytes = digestFile ? await readFile(digestFile) : Buffer.from(""); let assetCount = 0;
for (const line of digestBytes.toString("utf8").trim().split("\n").filter(Boolean)) {
  const [expected, asset] = line.trim().split(/\s+/, 2); let verified = false;
  for (let attempt = 1; attempt <= ASSET_PROPAGATION_ATTEMPTS; attempt += 1) {
    const assetUrl = new URL(`${base}/${asset.replace(/^\//, "")}`);
    assetUrl.searchParams.set("release_smoke", `${Date.now()}-${attempt}`);
    const response = await fetch(assetUrl, { cache: "no-store", headers: { "cache-control": "no-cache", pragma: "no-cache" } });
    const body = Buffer.from(await response.arrayBuffer());
    if (response.ok && createHash("sha256").update(body).digest("hex") === expected) { verified = true; break; }
    if (attempt < ASSET_PROPAGATION_ATTEMPTS) await wait(1_000);
  }
  if (!verified) throw new Error(`Asset digest gate failed after propagation retries: ${asset}`);
  assetCount += 1;
}
const report = { schemaVersion: 1, baseUrl: base, checkedAt: new Date().toISOString(), routes: routeResults, assetCount, assetManifestSha256: digestFile ? createHash("sha256").update(digestBytes).digest("hex") : null, rollbackRouteSmokeOnly: !digestFile };
const out = value("--out"); if (out) await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o444 });
console.log("preview smoke passed");
