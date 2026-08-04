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
