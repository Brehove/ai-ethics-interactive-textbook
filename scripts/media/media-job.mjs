import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { MediaError } from "./process-media.mjs";

const fail = (code, message) => { throw new MediaError(code, message); };
const safeKey = (value, prefix) => typeof value === "string" && value.startsWith(prefix) && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/.test(value) && !value.includes("//") && !value.split("/").includes("..");
const safeBasename = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) && !value.includes("..") && !value.includes("/");
export const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};

export function validateEnvelope(envelope) {
  const allowed = new Set(["schemaVersion", "jobId", "basename", "quarantineObjectKey", "expectedSource", "outputPrefix", "callback", "rights", "editorial", "accessibility", "captions", "poster"]);
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) || Object.keys(envelope).some((key) => !allowed.has(key))) fail("E_ENVELOPE_INVALID", "media envelope has unsupported fields");
  if (envelope.schemaVersion !== 1 || typeof envelope.jobId !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(envelope.jobId)) fail("E_ENVELOPE_INVALID", "schemaVersion and jobId are invalid");
  if (!safeBasename(envelope.basename)) fail("E_NAME_INVALID", "basename must be sanitized");
  if (!safeKey(envelope.quarantineObjectKey, "quarantine/")) fail("E_ENVELOPE_INVALID", "quarantineObjectKey must be a safe quarantine/ key");
  if (!safeKey(envelope.outputPrefix, "media/")) fail("E_ENVELOPE_INVALID", "outputPrefix must be a safe media/ prefix");
  if (!envelope.expectedSource || !/^[a-f0-9]{64}$/.test(envelope.expectedSource.sha256) || !Number.isInteger(envelope.expectedSource.bytes) || envelope.expectedSource.bytes < 1 || typeof envelope.expectedSource.mimeType !== "string" || !Number.isInteger(envelope.expectedSource.storageReservationBytes) || envelope.expectedSource.storageReservationBytes < envelope.expectedSource.bytes) fail("E_ENVELOPE_INVALID", "expectedSource hash, bytes, MIME, and storage reservation are required");
  let callbackUrl;
  try { callbackUrl = new URL(envelope.callback?.url); } catch { fail("E_ENVELOPE_INVALID", "callback.url must be an HTTPS URL"); }
  if (callbackUrl.protocol !== "https:" || callbackUrl.username || callbackUrl.password || callbackUrl.hash || callbackUrl.search || envelope.callback?.tokenRef !== "MEDIA_CALLBACK_TOKEN") fail("E_ENVELOPE_INVALID", "callback is not an approved token reference");
  for (const [name, record] of Object.entries({ rights: envelope.rights, editorial: envelope.editorial, accessibility: envelope.accessibility })) {
    if (!record || record.required !== true || typeof record.reviewId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(record.reviewId)) fail("E_ENVELOPE_INVALID", `${name} review metadata is required`);
  }
  return envelope;
}

export async function readEnvelope(file) { return validateEnvelope(JSON.parse(await readFile(file, "utf8"))); }

export function callbackPayload(envelope, manifest) {
  validateEnvelope(envelope);
  if (manifest.source.sha256 !== envelope.expectedSource.sha256 || manifest.source.bytes !== envelope.expectedSource.bytes || manifest.source.detectedMime !== envelope.expectedSource.mimeType) fail("E_SOURCE_MISMATCH", "processor manifest does not match immutable envelope source");
  return {
    schemaVersion: 1, jobId: envelope.jobId, idempotencyKey: `media:${envelope.jobId}:${manifest.source.sha256}`,
    quarantineObjectKey: envelope.quarantineObjectKey, outputPrefix: envelope.outputPrefix,
    immutableAddress: manifest.immutableAddress, manifestKey: `${envelope.outputPrefix}/sha256/${manifest.source.sha256}/manifest.json`,
    reviews: { rights: envelope.rights, editorial: envelope.editorial, accessibility: envelope.accessibility },
    publication: manifest.publication,
  };
}
export function callbackSignature(payload, token) {
  if (typeof token !== "string" || token.length < 32) fail("E_CALLBACK_TOKEN", "callback token is unavailable or too short");
  return `sha256=${createHmac("sha256", token).update(stableStringify(payload)).digest("hex")}`;
}
