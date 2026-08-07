#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

const VERSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

function exactVersion(value, label) {
  if (typeof value !== "string" || !VERSION_ID.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

export function planRecoveryBaseline({ observedActiveVersion, recordedRecoveryVersion, declaredUnrecordedVersion }) {
  const observed = exactVersion(observedActiveVersion, "observedActiveVersion");
  const recorded = exactVersion(recordedRecoveryVersion, "recordedRecoveryVersion");
  if (observed === recorded) {
    if (declaredUnrecordedVersion !== "none") throw new Error("An unrecorded version must not be declared when production already matches the receipt-backed recovery version");
    return Object.freeze({ repairRequired: false, observedActiveVersion: observed, recordedRecoveryVersion: recorded, declaredUnrecordedVersion: null });
  }
  if (declaredUnrecordedVersion === "none") throw new Error("An observed mismatch requires the exact unrecorded version declaration");
  const declared = exactVersion(declaredUnrecordedVersion, "declaredUnrecordedVersion");
  if (declared !== observed) throw new Error("The declared unrecorded version does not match the exact 100%-active Cloudflare version");
  if (declared === recorded) throw new Error("The unrecorded and receipt-backed recovery versions must be distinct");
  return Object.freeze({ repairRequired: true, observedActiveVersion: observed, recordedRecoveryVersion: recorded, declaredUnrecordedVersion: declared });
}

export function verifyRecoveryVersion({ observedActiveVersion, expectedVersion }) {
  const observed = exactVersion(observedActiveVersion, "observedActiveVersion");
  const expected = exactVersion(expectedVersion, "expectedVersion");
  if (observed !== expected) throw new Error("Cloudflare did not converge on the exact expected recovery version");
  return Object.freeze({ verified: true, observedActiveVersion: observed, expectedVersion: expected });
}

async function readObserved(path) {
  const value = JSON.parse(await readFile(path, "utf8"));
  return exactVersion(value?.cloudflareVersionId, "cloudflareVersionId");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  const value = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const required = (name) => value(name) ?? (() => { throw new Error(`${name} is required`); })();
  const result = command === "plan"
    ? planRecoveryBaseline({
        observedActiveVersion: await readObserved(required("--observed")),
        recordedRecoveryVersion: required("--recorded"),
        declaredUnrecordedVersion: required("--declared-unrecorded"),
      })
    : command === "verify"
      ? verifyRecoveryVersion({
          observedActiveVersion: await readObserved(required("--observed")),
          expectedVersion: required("--expected"),
        })
      : (() => { throw new Error("usage: plan|verify"); })();
  await writeFile(required("--out"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o444 });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
