import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("reader keeps the metadata title as the only visible chapter H1", async () => {
  const [chapterPage, globalCss] = await Promise.all([
    readFile(new URL("../../src/pages/chapter/[slug]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/styles/global.css", import.meta.url), "utf8"),
  ]);

  assert.match(chapterPage, /class="chapter-body" data-public-projection=/);
  assert.match(globalCss, /\.chapter-prose > \.chapter-body > h1:first-child \{ display: none; \}/);
});

test("static scholar fallback is inside the replaceable public projection boundary", async () => {
  const chapterPage = await readFile(new URL("../../src/pages/chapter/[slug]/index.astro", import.meta.url), "utf8");
  const projectionBoundary = chapterPage.match(/<div class="chapter-body" data-public-projection=[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.match(projectionBoundary, /<InlineScholarFigures/);
  assert.equal((chapterPage.match(/<InlineScholarFigures/g) ?? []).length, 1);
});

test("the public admin route is redirect-only and the dedicated editor is the sole writer", async () => {
  const [adminPage, editorMain, editorModel, editorWorker] = await Promise.all([
    readFile(new URL("../../src/pages/admin/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../../apps/instructor-editor/src/main.ts", import.meta.url), "utf8"),
    readFile(new URL("../../apps/instructor-editor/src/editor-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../../apps/instructor-editor/src/worker.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(adminPage, /Opening the chapter editor/);
  assert.match(adminPage, /auth\/start\?chapter=/);
  assert.doesNotMatch(adminPage, /EditorShell|contenteditable|Save draft|Submit review/);
  assert.match(editorMain, />Save</);
  assert.match(editorMain, /commitLive/);
  assert.match(editorMain, /chapter\.importPlainText/);
  assert.match(editorMain, /Structured source/);
  assert.match(editorMain, /Checkpoint/);
  assert.match(editorMain, /Media/);
  assert.match(editorMain, /Embed/);
  assert.match(editorMain, /Person \/ Scholar/);
  assert.match(editorMain, /Revision history/);
  assert.doesNotMatch(editorMain, /Legacy admin|future editor-engine adapter/);
  assert.match(editorModel, /chapter\.replaceDocument/);
  assert.match(editorWorker, /cache-control", "no-store"/);
});

test("chapter header offers an allowlisted OAuth edit entry at the nearest stable anchor", async () => {
  const [header, layout, chapterPage] = await Promise.all([
    readFile(new URL("../../src/components/SiteHeader.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/layouts/SiteLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/pages/chapter/[slug]/index.astro", import.meta.url), "utf8"),
  ]);
  assert.match(header, /PUBLIC_EDITOR_AUTH_ORIGIN/);
  assert.match(header, />Edit chapter</);
  assert.match(header, /new URL\("\/auth\/start", authOrigin\)/);
  assert.match(header, /target\.searchParams\.set\("anchor", anchor\)/);
  assert.doesNotMatch(header, /returnTo|searchParams\.set\("return"/);
  assert.match(layout, /documentId=\{documentId\}/);
  assert.match(chapterPage, /documentId=\{`chapter_\$\{meta\.id\}`\}/);
});
