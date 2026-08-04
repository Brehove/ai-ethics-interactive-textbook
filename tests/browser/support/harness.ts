import type { BrowserContext, Page, Response } from "@playwright/test";

export const readerRoutes = {
  chapter05: "/chapter/divine-command-natural-law-moral-authority/",
  chapter07: "/chapter/aristotle-character-and-ai-assisted-life/",
} as const;

export type PublicResponseEvidence = {
  url: string;
  status: number;
  headers: Record<string, string | undefined>;
};

const projectionHeaders = [
  "x-content-revision",
  "x-content-projection",
  "x-content-projection-hash",
] as const;

function isChapterResponse(response: Response, baseURL: string) {
  const url = new URL(response.url());
  const base = new URL(baseURL);
  return url.origin === base.origin && /^\/chapter\/[^/]+\/$/.test(url.pathname);
}

/**
 * Captures the reader response evidence that future commit-live tests must
 * compare with an API receipt. Header names are intentionally collected from
 * both the current static reader and the planned projection service.
 */
export function capturePublicResponseHeaders(page: Page, baseURL: string) {
  const observations: PublicResponseEvidence[] = [];
  const listener = (response: Response) => {
    if (!isChapterResponse(response, baseURL)) return;
    const headers = response.headers();
    observations.push({
      url: response.url(),
      status: response.status(),
      headers: Object.fromEntries(projectionHeaders.map((name) => [name, headers[name]])),
    });
  };
  page.on("response", listener);
  return {
    latest: () => observations.at(-1),
    all: () => [...observations],
    dispose: () => page.off("response", listener),
  };
}

/**
 * Prevents provider requests while recording attempted URLs. Future adapter
 * tests use this to prove that provider media remains fallback-first until a
 * reader explicitly activates it.
 */
export async function interceptProviderRequests(page: Page, providerHosts: readonly string[]) {
  const attempted: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (providerHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      attempted.push(url.toString());
      await route.abort();
      return;
    }
    await route.continue();
  });
  return {
    attempted: () => [...attempted],
    dispose: () => page.unroute("**/*"),
  };
}

/**
 * Adds a test-only instructor session cookie supplied by CI or a local test
 * auth fixture. It never creates a session or reads browser credentials.
 */
export async function installInstructorTestSession(context: BrowserContext) {
  const value = process.env.PLAYWRIGHT_INSTRUCTOR_SESSION;
  const editorOrigin = process.env.PLAYWRIGHT_EDITOR_ORIGIN;
  if (!value || !editorOrigin) {
    throw new Error("Instructor tests require PLAYWRIGHT_INSTRUCTOR_SESSION and PLAYWRIGHT_EDITOR_ORIGIN from a test auth fixture.");
  }
  const editorURL = new URL(editorOrigin);
  await context.addCookies([{
    name: process.env.PLAYWRIGHT_INSTRUCTOR_SESSION_COOKIE ?? "instructor_session",
    value,
    domain: editorURL.hostname,
    path: "/",
    httpOnly: true,
    secure: editorURL.protocol === "https:",
    sameSite: "Strict",
  }]);
}
