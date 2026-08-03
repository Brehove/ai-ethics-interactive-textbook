import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowPath = new URL("../../.github/workflows/content-release.yml", import.meta.url);
const rollbackWorkflowPath = new URL("../../.github/workflows/content-rollback.yml", import.meta.url);
const reconcileWorkflowPath = new URL("../../.github/workflows/content-release-reconcile.yml", import.meta.url);
const ciWorkflowPath = new URL("../../.github/workflows/ci.yml", import.meta.url);
const releaseCliPath = new URL("../../scripts/release/release-cli.mjs", import.meta.url);

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
  assert.match(workflow, /d1_document_ids:/);
  assert.match(workflow, /--d1-documents '\$\{\{ inputs\.d1_document_ids \}\}'/);
});

test("rollback workflow restores Cloudflare and the full database release state through one protected path", async () => {
  const workflow = await readFile(rollbackWorkflowPath, "utf8");
  assert.match(workflow, /environment: content-production/);
  assert.match(workflow, /control-plane\.mjs stage-rollback/);
  assert.match(workflow, /wrangler versions deploy/);
  assert.match(workflow, /control-plane\.mjs receipt/);
  assert.match(workflow, /control-plane\.mjs audit-state/);
  assert.match(workflow, /cloudflare-active-version\.mjs/);
  assert.match(workflow, /previousCloudflareVersionId/);
  assert.match(workflow, /steps\.precheck\.outcome == 'success'/);
  assert.match(workflow, /control-plane\.mjs emergency-rollback/);
  assert.match(workflow, /concurrency:\n\s+group: content-production-release/);
  assert.doesNotMatch(workflow, /actions\/(?:upload|download)-artifact@v4(?:\s|$)/);
});

test("release workflow requires signed candidates and human-gated promotion", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const releaseCli = await readFile(releaseCliPath, "utf8");
  assert.match(workflow, /RELEASE_SIGNING_KEY: \$\{\{ secrets\.RELEASE_SIGNING_KEY \}\}/);
  assert.match(workflow, /environment: content-production/);
  assert.match(workflow, /if: \$\{\{ inputs\.promote \}\}/);
  assert.doesNotMatch(workflow, /RELEASE_ALLOW_UNSIGNED/);
  assert.match(workflow, /id: stage/);
  assert.match(workflow, /control-plane\.mjs stage/);
  assert.match(workflow, /control-plane\.mjs receipt/);
  assert.match(workflow, /control-plane\.mjs activate-authority/);
  assert.match(workflow, /control-plane\.mjs audit-state/);
  assert.match(workflow, /pre-promotion-cloudflare-status\.json/);
  assert.match(workflow, /test "\$observed" = '\$\{\{ inputs\.rollback_version_id \}\}'/);
  assert.match(workflow, /--receipt release-artifacts\/deployment-receipt\.json/);
  assert.match(workflow, /RELEASE_DEPLOY_RECEIPT_TOKEN: \$\{\{ secrets\.RELEASE_DEPLOY_RECEIPT_TOKEN \}\}/);
  assert.match(workflow, /control-plane\.mjs emergency-rollback/);
  assert.match(workflow, /steps\.stage\.outcome == 'success'/);
  assert.match(workflow, /--base-url https:\/\/ethicsandai\.your-digital-life\.org/);
  assert.doesNotMatch(workflow, /--preview-url|CLOUDFLARE_RELEASE_PREVIEW_URL/);
  assert.match(releaseCli, /const preview = stdout\.match/);
  assert.match(releaseCli, /workers\\\.dev/);
  assert.match(releaseCli, /Wrangler did not return the exact immutable version preview URL/);
  assert.doesNotMatch(workflow, /actions\/(?:upload|download)-artifact@v4(?:\s|$)/);
  const checkouts = [...workflow.matchAll(/uses: actions\/checkout@[^\n]+\n\s+with:\n([\s\S]*?)(?=\n\s+- (?:uses|name|run):)/g)];
  assert.equal(checkouts.length, 3);
  for (const checkout of checkouts) assert.match(checkout[1], /ref: \$\{\{ inputs\.commit_sha \}\}/);
});

test("recovery workflow reconciles only exact target or recovery Worker versions", async () => {
  const workflow = await readFile(reconcileWorkflowPath, "utf8");
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /environment: content-production-recovery/);
  assert.match(workflow, /control-plane\.mjs pending/);
  assert.match(workflow, /cloudflare-active-version\.mjs/);
  assert.match(workflow, /reconcile-receipt/);
  assert.match(workflow, /activate-authority-map/);
  assert.match(workflow, /control-plane\.mjs abandon/);
  assert.match(workflow, /control-plane\.mjs audit-state/);
  assert.match(workflow, /outcome==='ambiguous'/);
  assert.match(workflow, /concurrency:\n\s+group: content-production-release/);
  assert.doesNotMatch(workflow, /actions\/(?:upload|download)-artifact@v4(?:\s|$)/);
});

test("CI validates every Worker bundle and the complete D1 migration chain", async () => {
  const workflow = await readFile(ciWorkflowPath, "utf8");
  assert.match(workflow, /wrangler d1 migrations apply ai-ethics-content --local/);
  for (const config of ["workers/editor-auth/wrangler.jsonc", "workers/content-api/wrangler.jsonc", "workers/textbook-preview/wrangler.jsonc", "workers/textbook-mcp/wrangler.jsonc"]) assert.match(workflow, new RegExp(config.replaceAll("/", "\\/")));
  assert.match(workflow, /npx wrangler deploy --dry-run\n/);
});
