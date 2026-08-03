import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowPath = new URL("../../.github/workflows/content-release.yml", import.meta.url);

test("release workflow derives an immutable snapshot route from the hash", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.doesNotMatch(workflow, /^\s+snapshot_url:/m);
  assert.match(workflow, /SNAPSHOT_URL="https:\/\/auth\.ethicsandai\.your-digital-life\.org\/v1\/release-snapshots\/\$SNAPSHOT_HASH"/);
  assert.match(workflow, /--proto '=https'/);
  assert.doesNotMatch(workflow, /curl[^\n]*--location/);
  assert.match(workflow, /sha256sum --check --status/);
  assert.match(workflow, /x-content-snapshot-revision:/);
  assert.match(workflow, /test "\$returned_revision" = "\$SNAPSHOT_REVISION"/);
  assert.match(workflow, /RELEASE_ASSET_TOKEN: \$\{\{ secrets\.SUBMITTED_SNAPSHOT_READ_TOKEN \}\}/);
});

test("release workflow requires signed candidates and human-gated promotion", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /RELEASE_SIGNING_KEY: \$\{\{ secrets\.RELEASE_SIGNING_KEY \}\}/);
  assert.match(workflow, /environment: content-production/);
  assert.match(workflow, /if: \$\{\{ inputs\.promote \}\}/);
  assert.doesNotMatch(workflow, /RELEASE_ALLOW_UNSIGNED/);
  assert.match(workflow, /id: stage/);
  assert.match(workflow, /control-plane\.mjs stage/);
  assert.match(workflow, /control-plane\.mjs receipt/);
  assert.match(workflow, /RELEASE_DEPLOY_RECEIPT_TOKEN: \$\{\{ secrets\.RELEASE_DEPLOY_RECEIPT_TOKEN \}\}/);
  assert.match(workflow, /control-plane\.mjs emergency-rollback/);
  assert.match(workflow, /steps\.stage\.outcome == 'success'/);
  assert.match(workflow, /--base-url https:\/\/ethicsandai\.your-digital-life\.org/);
  const checkouts = [...workflow.matchAll(/uses: actions\/checkout@[^\n]+\n\s+with:\n([\s\S]*?)(?=\n\s+- (?:uses|name|run):)/g)];
  assert.equal(checkouts.length, 3);
  for (const checkout of checkouts) assert.match(checkout[1], /ref: \$\{\{ inputs\.commit_sha \}\}/);
});
