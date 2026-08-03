import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitContentRepository } from "../../packages/content-repository/src/index.ts";

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");
const exported = await new GitContentRepository(root).exportSnapshot();
process.stdout.write(`${JSON.stringify({ sha256: exported.sha256, report: exported.report }, null, 2)}\n`);
