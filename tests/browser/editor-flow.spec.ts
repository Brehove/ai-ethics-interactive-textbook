import { expect, test } from "@playwright/test";

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
});
