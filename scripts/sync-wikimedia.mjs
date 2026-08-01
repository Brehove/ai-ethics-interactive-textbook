#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { MAX_WIKIMEDIA_CONCURRENCY, syncWikimedia } from "./wikimedia-lib.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArguments(argv) {
  const options = { mode: null, concurrency: MAX_WIKIMEDIA_CONCURRENCY, manifestPath: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--write") options.mode = options.mode ? "invalid" : "write";
    else if (argv[index] === "--check") options.mode = options.mode ? "invalid" : "check";
    else if (argv[index] === "--concurrency") options.concurrency = Number(argv[++index]);
    else if (argv[index] === "--manifest") options.manifestPath = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!options.mode || options.mode === "invalid") throw new Error("Choose exactly one mode: --write or --check");
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await syncWikimedia({ projectRoot, ...options });
  const action = options.mode === "check" ? "is current" : `refreshed ${result.changed.length} file(s)`;
  process.stdout.write(`Wikimedia layer ${action}: ${result.people} people, ${result.media} media; concurrency <= ${options.concurrency}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
