#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const required = (name) => value(name) ?? (() => { throw new Error(`${name} is required`); })();
const status = JSON.parse(await readFile(required("--in"), "utf8"));
if (!status || typeof status !== "object" || Array.isArray(status) || !Array.isArray(status.versions)) throw new Error("Cloudflare deployment status has an unsupported shape");
const active = status.versions.filter((item) => item && item.percentage === 100 && typeof item.version_id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(item.version_id));
if (active.length !== 1 || status.versions.some((item) => item?.percentage !== 100 && Number(item?.percentage) > 0)) throw new Error("Cloudflare traffic is split or does not have exactly one 100%-active version");
const result = { deploymentId: status.id || null, cloudflareVersionId: active[0].version_id, percentage: 100, observedAt: new Date().toISOString() };
await writeFile(required("--out"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o444 });
console.log(JSON.stringify(result));
