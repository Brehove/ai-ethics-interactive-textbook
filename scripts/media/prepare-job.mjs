#!/usr/bin/env node
import { readEnvelope } from "./media-job.mjs";
const file = process.argv[2];
if (!file || process.argv.length !== 3) throw new Error("usage: prepare-job.mjs <envelope.json>");
const job = await readEnvelope(file);
if (process.env.MEDIA_EXPECTED_JOB_ID && process.env.MEDIA_EXPECTED_JOB_ID !== job.jobId) throw new Error("immutable envelope jobId mismatch");
const output = process.env.GITHUB_OUTPUT;
if (!output) throw new Error("GITHUB_OUTPUT is required");
await (await import("node:fs/promises")).appendFile(output, `basename=${job.basename}\nquarantine_key=${job.quarantineObjectKey}\noutput_prefix=${job.outputPrefix}\ncallback_url=${job.callback.url}\n`);
