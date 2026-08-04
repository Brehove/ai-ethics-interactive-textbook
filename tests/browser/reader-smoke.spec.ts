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
