import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const validator = process.env.CODEX_SKILL_VALIDATOR || join(homedir(), ".codex", "skills", ".system", "skill-creator", "scripts", "quick_validate.py");
for (const name of ["author-textbook-chapter", "manage-prompt-checkpoints", "publish-textbook-media", "release-steward"]) {
  test(`${name} skill validates`, () => {
    assert.equal(existsSync(validator), true, "Set CODEX_SKILL_VALIDATOR to the official skill-creator quick_validate.py path");
    const result = spawnSync("python3", [validator, resolve(".agents/skills", name)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Skill is valid/);
  });
}
