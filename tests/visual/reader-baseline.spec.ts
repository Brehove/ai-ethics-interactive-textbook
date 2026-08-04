import { expect, test } from "@playwright/test";
import { capturePublicResponseHeaders, readerRoutes } from "../browser/support/harness";

const baselines = [
  { id: "chapter-05-aquinas", route: readerRoutes.chapter05, heading: "Is It Good Because God Commands It?" },
  { id: "chapter-07-reader", route: readerRoutes.chapter07, heading: "What Are You Becoming?" },
] as const;

for (const baseline of baselines) {
  test(`captures ${baseline.id} @baseline`, async ({ page, baseURL }, testInfo) => {
    test.skip(!baseURL, "The visual harness requires a local reader base URL.");
    const publicResponses = capturePublicResponseHeaders(page, baseURL!);
    await page.goto(baseline.route, { waitUntil: "networkidle" });
    await expect(page.locator("main#main-content")).toContainText(baseline.heading);
    const [screenshot, responseEvidence] = [
      await page.screenshot({ fullPage: true }),
      publicResponses.latest(),
    ];
    await testInfo.attach(`${baseline.id}.png`, { body: screenshot, contentType: "image/png" });
    await testInfo.attach(`${baseline.id}.headers.json`, {
      body: JSON.stringify(responseEvidence, null, 2),
      contentType: "application/json",
    });
    publicResponses.dispose();
  });
}
