import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findForbiddenDeploymentHtmlElements, validateContent } from "../validate-content.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("deployment HTML detector rejects raw script, style, and form tags only", () => {
  assert.deepEqual(
    findForbiddenDeploymentHtmlElements('<script src="/reader.js"></script><STYLE>.reader {}</STYLE><form action="/submit"></form>'),
    ["script", "style", "form"],
  );
  assert.deepEqual(findForbiddenDeploymentHtmlElements("<aside>Reader note</aside><scripted-example>safe</scripted-example>"), []);
});

test("canonical content validation rejects unsafe deployment HTML in a chapter", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "ai-ethics-content-validator-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await cp(path.join(projectRoot, "content"), path.join(fixtureRoot, "content"), { recursive: true });

  const chapterPath = path.join(fixtureRoot, "content/chapters/01-practicing-philosophy/chapter.md");
  const chapter = await readFile(chapterPath, "utf8");
  await writeFile(chapterPath, `${chapter}\n<script>window.readerInjected = true;</script>\n`);

  await assert.rejects(
    () => validateContent({ projectRoot: fixtureRoot }),
    /ch01: forbidden deployment HTML element/,
  );
});
