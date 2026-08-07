import { expect, test } from "@playwright/test";
import { capturePublicResponseHeaders, interceptProviderRequests, readerRoutes } from "./support/harness";

test("anonymous Chapter 7 reader renders without contacting a provider", async ({ page, baseURL }) => {
  test.skip(!baseURL, "The browser harness requires a local reader base URL.");
  const publicResponses = capturePublicResponseHeaders(page, baseURL!);
  const providers = await interceptProviderRequests(page, [
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "x.com",
    "twitter.com",
    "open.spotify.com",
    "soundcloud.com",
    "bsky.app",
  ]);

  try {
    await page.goto(readerRoutes.chapter07, { waitUntil: "networkidle" });
    await expect(page).toHaveTitle(/What Are You Becoming\?.*AI & Ethics/);
    await expect(page.locator("main#main-content")).toContainText("What Are You Becoming?");
    await expect(page.locator(".chapter-body")).toBeVisible();
    expect(publicResponses.latest()).toMatchObject({ status: 200 });
    expect(providers.attempted()).toEqual([]);
  } finally {
    publicResponses.dispose();
    await providers.dispose();
  }
});

test("default chapter reading is centered and reserves no context-panel width", async ({ page, baseURL }) => {
  test.skip(!baseURL, "The browser harness requires a local reader base URL.");

  for (const route of [readerRoutes.chapter05, readerRoutes.chapter07]) {
    await page.goto(route, { waitUntil: "networkidle" });
    const shell = page.locator(".reader-shell");
    const panel = page.locator("#context-panel");
    await expect(shell).toHaveAttribute("data-context-closed", "true");
    await expect(panel).toBeHidden();

    const viewport = page.viewportSize();
    if (viewport && viewport.width > 900) {
      const mainBox = await page.locator(".reader-main").boundingBox();
      const columnBox = await page.locator(".reader-column").boundingBox();
      expect(mainBox).not.toBeNull();
      expect(columnBox).not.toBeNull();
      const leftMargin = columnBox!.x - mainBox!.x;
      const rightMargin = mainBox!.x + mainBox!.width - columnBox!.x - columnBox!.width;
      expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(2);
      expect(columnBox!.width).toBeLessThanOrEqual(768.5);
    }
  }
});

test("opening and closing the reading record restores the centered chapter", async ({ page, baseURL }) => {
  test.skip(!baseURL, "The browser harness requires a local reader base URL.");

  await page.goto(readerRoutes.chapter07, { waitUntil: "networkidle" });
  const shell = page.locator(".reader-shell");
  const column = page.locator(".reader-column");
  const initialBox = await column.boundingBox();
  const firstCheckpoint = page.locator("[data-reading-record-trigger]").first();
  const trigger = firstCheckpoint.getByRole("button", { name: /Respond to checkpoint 1/ });
  await trigger.click();

  await expect(shell).not.toHaveAttribute("data-context-closed", "true");
  await expect(page.locator("#context-panel")).toBeVisible();
  await expect(page.locator("[data-response-text]")).toBeFocused();

  await page.getByRole("button", { name: "Close reading record" }).click();
  await expect(shell).toHaveAttribute("data-context-closed", "true");
  await expect(page.locator("#context-panel")).toBeHidden();
  await expect(trigger).toBeFocused();

  const viewport = page.viewportSize();
  if (viewport && viewport.width > 900) {
    const restoredBox = await column.boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(initialBox).not.toBeNull();
    expect(Math.abs(restoredBox!.x - initialBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(restoredBox!.width - initialBox!.width)).toBeLessThanOrEqual(1);
  }
});

test("@a11y checkpoint opens a page-memory response and progress resets on reload", async ({ page, baseURL }) => {
  test.skip(!baseURL, "The browser harness requires a local reader base URL.");
  const writes: string[] = [];
  const browserErrors: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto(readerRoutes.chapter07, { waitUntil: "networkidle" });
  const firstCheckpoint = page.locator("[data-reading-record-trigger]").first();
  await expect(firstCheckpoint).toBeVisible();
  await expect(firstCheckpoint).toContainText("Response required");
  await firstCheckpoint.getByRole("button", { name: /Respond to checkpoint 1/ }).click();

  const response = page.locator("[data-response-text]");
  await expect(response).toBeVisible();
  await response.fill("The apology is assistance only if the writer remains responsible for its meaning, delivery, and future practice. Repeated outsourcing would instead train avoidance and weaken the sincere habits that friendship requires over time.");
  await page.locator("[data-request-preserve]").click();
  await page.locator("[data-confirm-preserve]").click();
  await expect(page.locator("[data-header-record-progress]").first()).toHaveText("1/3");
  expect(writes).toEqual([]);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-header-record-progress]").first()).toHaveText("0/3");
  expect(browserErrors).toEqual([]);
});
