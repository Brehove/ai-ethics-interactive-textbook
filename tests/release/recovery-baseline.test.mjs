import assert from "node:assert/strict";
import test from "node:test";
import { planRecoveryBaseline, verifyRecoveryVersion } from "../../scripts/release/recovery-baseline.mjs";

test("an aligned receipt-backed baseline requires no repair declaration", () => {
  assert.deepEqual(planRecoveryBaseline({ observedActiveVersion: "version_recorded", recordedRecoveryVersion: "version_recorded", declaredUnrecordedVersion: "none" }), {
    repairRequired: false,
    observedActiveVersion: "version_recorded",
    recordedRecoveryVersion: "version_recorded",
    declaredUnrecordedVersion: null,
  });
  assert.throws(() => planRecoveryBaseline({ observedActiveVersion: "version_recorded", recordedRecoveryVersion: "version_recorded", declaredUnrecordedVersion: "version_extra" }), /must not be declared/);
});

test("a drift repair binds the exact observed and declared unrecorded version", () => {
  assert.deepEqual(planRecoveryBaseline({ observedActiveVersion: "version_live", recordedRecoveryVersion: "version_recorded", declaredUnrecordedVersion: "version_live" }), {
    repairRequired: true,
    observedActiveVersion: "version_live",
    recordedRecoveryVersion: "version_recorded",
    declaredUnrecordedVersion: "version_live",
  });
  assert.throws(() => planRecoveryBaseline({ observedActiveVersion: "version_live", recordedRecoveryVersion: "version_recorded", declaredUnrecordedVersion: "version_other" }), /does not match/);
  assert.throws(() => planRecoveryBaseline({ observedActiveVersion: "version_live", recordedRecoveryVersion: "version_recorded", declaredUnrecordedVersion: "none" }), /requires the exact unrecorded version/);
});

test("recovery verification requires exact Cloudflare convergence", () => {
  assert.deepEqual(verifyRecoveryVersion({ observedActiveVersion: "version_expected", expectedVersion: "version_expected" }), {
    verified: true,
    observedActiveVersion: "version_expected",
    expectedVersion: "version_expected",
  });
  assert.throws(() => verifyRecoveryVersion({ observedActiveVersion: "version_other", expectedVersion: "version_expected" }), /did not converge/);
  assert.throws(() => verifyRecoveryVersion({ observedActiveVersion: "bad version", expectedVersion: "version_expected" }), /invalid/);
});
