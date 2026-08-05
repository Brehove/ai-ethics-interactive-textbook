import { expect, test } from "@playwright/test";
import { installMockAuthoringApi } from "./support/harness";

const editor = "http://127.0.0.1:4173/chapter/what-are-you-becoming-aristotle-character-and-ai-assisted-life";

test("continuous editor inserts at the cursor and preserves managed scholar content through whole-chapter paste", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(editor);
  await expect(page.getByRole("textbox", { name: "Continuous chapter document" })).toBeVisible();
  await expect(page.getByText("Aristotle", { exact: true }).first()).toBeVisible();

  const secondPassage = page.locator('[data-passage-id="passage_character"]').first();
  await secondPassage.click();
  await page.getByRole("button", { name: "Checkpoint" }).click();
  await expect(page.getByText(/Anchored after passage_character/)).toBeVisible();
  await page.getByLabel("Title").fill("A new checkpoint");
  await page.getByLabel("Prompt").fill("Explain what should remain your responsibility.");
  await page.getByRole("button", { name: "Add checkpoint" }).click();
  await expect(page.getByText("A new checkpoint", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Replace chapter" }).click();
  await page.getByLabel("Chapter text").fill("Replacement opening.\n\nReplacement conclusion.");
  await page.getByRole("button", { name: "Apply local replacement" }).click();
  await expect(page.getByText("Replacement opening.", { exact: true })).toBeVisible();
  await expect(page.getByText("Aristotle", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("reader and editor expose keyboard-named landmarks and controls @a11y", async ({ page }) => {
  await page.goto(editor);
  await expect(page.getByRole("toolbar", { name: "Chapter formatting" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Contextual inspector" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("media library presents a Pressbooks-style upload entry without exposing a second storage path", async ({ page }) => {
  await page.goto(editor);
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Insert media" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload new media" })).toBeVisible();
  await expect(page.getByText(/safe derivatives|authenticated derivative/)).toBeVisible();
  await page.getByRole("button", { name: "Upload new media" }).evaluate((button) => button.removeAttribute("disabled"));
  await page.getByRole("button", { name: "Upload new media" }).click();
  await expect(page.getByRole("heading", { name: "Upload new media" })).toBeVisible();
  await expect(page.getByLabel("Rights basis")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review and upload" })).toBeVisible();
});

test("failed save preserves the editor mount, visible order, undo history, and recovery copy", async ({ page }) => {
  const api = await installMockAuthoringApi(page, { commitStatus: 422 });
  await page.goto(`${editor}?testApiOrigin=http://127.0.0.1:4173`);
  await expect(page.getByText("Browser checkpoint", { exact: true })).toBeVisible();
  const document = page.locator("[data-document]");
  await document.evaluate((node) => { node.setAttribute("data-mount-proof", "original"); });
  const second = page.locator('[data-document] p[data-passage-id="passage_browser_second"]');
  await second.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Added before save.");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  const checkpointBefore = await page.locator('[data-checkpoint-id="checkpoint_browser"]').evaluate((node) => node.previousElementSibling?.getAttribute("data-passage-id"));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Save needs attention", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Two paragraphs share passage_browser_second.");
  await expect(page.getByRole("alert")).toContainText("body.2.passageId");
  await expect(document).toHaveAttribute("data-mount-proof", "original");
  const checkpointAfter = await page.locator('[data-checkpoint-id="checkpoint_browser"]').evaluate((node) => node.previousElementSibling?.getAttribute("data-passage-id"));
  expect(checkpointAfter).toBe(checkpointBefore);
  expect(await page.evaluate(() => Object.keys(sessionStorage).some((key) => key.startsWith("ai-ethics-instructor-recovery/chapter_ch07/")))).toBe(true);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(second).not.toContainText("Added before save.");
  expect(api.calls().filter((call) => call.path.endsWith(":commitLive"))).toHaveLength(1);
});

test("verified save clears the exact recovery key without remounting the editor", async ({ page }) => {
  await installMockAuthoringApi(page);
  await page.goto(`${editor}?testApiOrigin=http://127.0.0.1:4173`);
  const document = page.locator("[data-document]");
  await document.evaluate((node) => { node.setAttribute("data-mount-proof", "verified"); });
  const second = page.locator('[data-document] p[data-passage-id="passage_browser_second"]');
  await second.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Saved addition.");
  await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("ai-ethics-instructor-recovery/chapter_ch07/")).length)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(document).toHaveAttribute("data-mount-proof", "verified");
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("ai-ethics-instructor-recovery/chapter_ch07/")).length)).toBe(0);
});
