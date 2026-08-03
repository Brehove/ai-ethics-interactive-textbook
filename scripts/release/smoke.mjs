import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const args = process.argv.slice(2); const value = (name) => args[args.indexOf(name) + 1];
const base = value("--base-url")?.replace(/\/$/, ""); const digestFile = value("--asset-digests");
if (!base || !digestFile) throw new Error("usage: smoke.mjs --base-url <preview> --asset-digests <file>");
const requiredRoutes = ["/", "/chapter/aristotle-character-and-ai-assisted-life/"];
for (const route of requiredRoutes) {
  const response = await fetch(`${base}${route}`, { headers: { "user-agent": "release-smoke/no-js" } });
  if (!response.ok) throw new Error(`Smoke route failed: ${route} (${response.status})`);
  const html = await response.text();
  if (!/<main[\s>]/i.test(html) || !/<h1[\s>]/i.test(html)) throw new Error(`No-JS reader gate failed: ${route} lacks server-rendered main content`);
  const responseCsp = response.headers.get("content-security-policy") ?? "";
  const metaCsp = html.match(/<meta\s+http-equiv=["']content-security-policy["']\s+content=["']([^"']+)["']/i)?.[1] ?? "";
  const csp = `${responseCsp};${metaCsp}`;
  if (!/default-src\s+'self'/.test(csp) || !/object-src\s+'none'/.test(csp)) throw new Error(`Smoke CSP gate failed: ${route}`);
}
for (const line of (await readFile(digestFile, "utf8")).trim().split("\n").filter(Boolean)) {
  const [expected, asset] = line.trim().split(/\s+/, 2); const response = await fetch(`${base}/${asset.replace(/^\//, "")}`); const body = Buffer.from(await response.arrayBuffer());
  if (!response.ok || createHash("sha256").update(body).digest("hex") !== expected) throw new Error(`Asset digest gate failed: ${asset}`);
}
console.log("preview smoke passed");
