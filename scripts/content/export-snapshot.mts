import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitContentRepository } from "../../packages/content-repository/src/index.ts";

const contentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");
const output = path.resolve(process.argv[2] ?? "content/snapshots/git-book.snapshot.json");
const exported = await new GitContentRepository(contentRoot).exportSnapshot();
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(exported.snapshot, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output, sha256: exported.sha256, report: exported.report }, null, 2)}\n`);
