import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/release/cloudflare-active-version.mjs", import.meta.url));

test("extracts one exact 100%-active immutable Cloudflare version", async () => {
  const dir = await mkdtemp(join(tmpdir(), "phil123-cf-active-"));
  const input = join(dir, "status.json"); const output = join(dir, "active.json");
  await writeFile(input, JSON.stringify({ id: "deployment_1", versions: [{ version_id: "version_exact_1", percentage: 100 }] }));
  const result = spawnSync(process.execPath, [script, "--in", input, "--out", output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(await readFile(output, "utf8")).cloudflareVersionId, "version_exact_1");
});

test("rejects split Cloudflare traffic", async () => {
  const dir = await mkdtemp(join(tmpdir(), "phil123-cf-split-"));
  const input = join(dir, "status.json"); const output = join(dir, "active.json");
  await writeFile(input, JSON.stringify({ id: "deployment_2", versions: [{ version_id: "version_a", percentage: 90 }, { version_id: "version_b", percentage: 10 }] }));
  const result = spawnSync(process.execPath, [script, "--in", input, "--out", output], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly one 100%-active version/);
});
