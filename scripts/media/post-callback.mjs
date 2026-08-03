#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { callbackPayload, callbackSignature, readEnvelope, stableStringify } from "./media-job.mjs";
const [envelopeFile, manifestFile] = process.argv.slice(2);
if (!envelopeFile || !manifestFile || process.argv.length !== 4) throw new Error("usage: post-callback.mjs <envelope.json> <manifest.json>");
const token = process.env.MEDIA_CALLBACK_TOKEN;
const envelope = await readEnvelope(envelopeFile); const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
const payload = callbackPayload(envelope, manifest); const body = stableStringify(payload); const response = await fetch(envelope.callback.url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": payload.idempotencyKey, "x-media-signature": callbackSignature(payload, token) }, body });
if (!response.ok) throw new Error(`callback rejected completion (${response.status})`);
