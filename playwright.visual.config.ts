import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? "http://127.0.0.1:4321";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const chromiumLaunch = executablePath ? { launchOptions: { executablePath } } : {};

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: "test-results/visual",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css" } },
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  use: {
    baseURL,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "America/Boise",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // An explicit base URL is a caller-owned server. Otherwise Playwright starts
  // this repository's reader and fails loudly if the default port is occupied.
  ...(externalBaseURL ? {} : {
    webServer: {
      command: "npm run preview -- --host 127.0.0.1 --port 4321",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  }),
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1536, height: 1024 }, ...chromiumLaunch } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium", ...chromiumLaunch } },
  ],
});
