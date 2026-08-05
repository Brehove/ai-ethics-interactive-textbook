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

export type MockAuthoringApiOptions = {
  commitStatus?: number;
  commitError?: { code: string; message: string; details?: unknown };
};

const mockChapter = {
  schemaVersion: 2,
  chapterId: "chapter_ch07",
  slug: "aristotle-character-and-ai-assisted-life",
  title: "Aristotle, Character, and the AI-Assisted Life",
  revisionId: "revision_browser_base",
  chapterVersion: "revision_browser_base",
  status: "published",
  body: [
    { type: "paragraph", blockId: "block_browser_opening", passageId: "passage_browser_opening", text: "A visible browser-test passage." },
    { type: "paragraph", blockId: "block_browser_second", passageId: "passage_browser_second", text: "A second passage before the checkpoint." },
  ],
  checkpoints: [{ checkpointId: "checkpoint_browser", passageId: "passage_browser_second", passageExcerptHash: "a".repeat(64), displayOrder: 0, title: "Browser checkpoint", trigger: "Pause.", prompt: "Make a judgment.", guidance: "Use the passage.", strategy: "initial-judgment", responseStructure: "prose", minWords: 30, maxWords: 120, showInSidebar: true, rationale: "Test stable flow." }],
  personFeatures: [],
  managedPlacements: [],
};

/** Localhost-only production-shaped Content API seam for editor save/recovery tests. */
export async function installMockAuthoringApi(page: Page, options: MockAuthoringApiOptions = {}) {
  const calls: Array<{ path: string; method: string; body?: unknown }> = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = method === "GET" ? undefined : request.postDataJSON();
    const respond = (status: number, payload: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    if (url.pathname === "/api/session") {
      calls.push({ path: url.pathname, method });
      return respond(200, { csrf_token: "csrf_browser", expires_at: Date.now() + 60_000 });
    }
    if (url.pathname.endsWith("/authoring-view")) {
      calls.push({ path: url.pathname, method });
      return respond(200, { documentId: "chapter_ch07", revisionId: "revision_browser_base", chapter: mockChapter });
    }
    if (url.pathname.endsWith("/changesets") && method === "POST") {
      calls.push({ path: url.pathname, method, body });
      return respond(201, { id: "changeset_browser", state: "open", resumed: true, baseRevisionId: "revision_browser_base", version: 1, chapter: mockChapter });
    }
    if (url.pathname.endsWith(":commitLive") && method === "POST") {
      calls.push({ path: url.pathname, method, body });
      if ((options.commitStatus ?? 201) >= 400) return respond(options.commitStatus ?? 422, { error: options.commitError ?? { code: "VALIDATION_FAILED", message: "Replacement chapter is structurally invalid", details: { errors: [{ code: "STABLE_ID_DUPLICATE", path: "body.2.passageId", message: "Two paragraphs share passage_browser_second." }] } } });
      return respond(201, { commitReceiptId: "commit_browser", changeSetId: "changeset_browser", documentId: "chapter_ch07", revisionId: "revision_browser_saved", contentHash: "b".repeat(64), projectionId: "projection_browser", projectionHash: "c".repeat(64), publicUrl: "https://reader.example/chapter/aristotle-character-and-ai-assisted-life/", deliveryStatus: "verified", statusUrl: "/v1/live-commits/commit_browser", statusExpiresAt: "2099-01-01T00:00:00Z", committed: true, live: true, noOp: false });
    }
    await route.continue();
  });
  return { calls: () => [...calls], dispose: () => page.unroute("**/*") };
}

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
