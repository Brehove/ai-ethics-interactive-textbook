import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const validator = process.env.CODEX_SKILL_VALIDATOR || join(homedir(), ".codex", "skills", ".system", "skill-creator", "scripts", "quick_validate.py");
const allowedFrontmatter = new Set(["name", "description", "license", "allowed-tools", "metadata"]);

function validatePortableSkill(name) {
  const directory = resolve(".agents/skills", name);
  const content = readFileSync(join(directory, "SKILL.md"), "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  assert.ok(match, "SKILL.md requires a bounded YAML frontmatter block");
  const keys = [...match[1].matchAll(/^([A-Za-z][A-Za-z0-9-]*):/gm)].map((item) => item[1]);
  assert.equal(keys.every((key) => allowedFrontmatter.has(key)), true, `Unexpected skill frontmatter key: ${keys.find((key) => !allowedFrontmatter.has(key))}`);
  const scalar = (key) => {
    const value = match[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
    return value && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) ? value.slice(1, -1) : value;
  };
  const declaredName = scalar("name");
  const description = scalar("description");
  assert.equal(declaredName, name, "Skill name must match its directory");
  assert.match(declaredName, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(declaredName.length <= 64, true);
  assert.equal(Boolean(description) && description.length <= 1024 && !/[<>]/.test(description), true, "Skill description is missing or invalid");
  assert.equal(existsSync(join(directory, "agents", "openai.yaml")), true, "Skill requires agents/openai.yaml");
}

for (const name of ["ai-ethics-author-textbook-chapter", "ai-ethics-manage-prompt-checkpoints", "ai-ethics-publish-textbook-media", "ai-ethics-release-steward"]) {
  test(`${name} skill validates`, () => {
    if (existsSync(validator)) {
      const result = spawnSync("python3", [validator, resolve(".agents/skills", name)], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /Skill is valid/);
    } else validatePortableSkill(name);
  });
}

test("skill bundle manifest covers the exact repository files and hashes", () => {
  const result = spawnSync(process.execPath, ["scripts/skills/check-bundle.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("Codex plugin packages byte-identical copies of all four repository skills", () => {
  const source = resolve(".agents/skills");
  const packaged = resolve("plugins/ai-ethics-textbook/skills");
  const files = (directory) => readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
  const sourceFiles = files(source).filter((path) => !path.endsWith("bundle-manifest.json"));
  assert.deepEqual(sourceFiles.map((path) => path.slice(source.length + 1)).sort(), files(packaged).map((path) => path.slice(packaged.length + 1)).sort());
  for (const sourcePath of sourceFiles) {
    const relative = sourcePath.slice(source.length + 1);
    assert.equal(readFileSync(join(packaged, relative), "utf8"), readFileSync(sourcePath, "utf8"), `${relative} drifted in the plugin`);
  }
});
