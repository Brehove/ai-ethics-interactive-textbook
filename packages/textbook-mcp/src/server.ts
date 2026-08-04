import { randomUUID } from "node:crypto";
import { createMcp, verifyCapability } from "../../../workers/textbook-mcp/src/index.mjs";

// This optional Node bridge deliberately reuses the deployed Worker's tool
// registry. There is one set of semantic operation schemas, media tools, and
// safety annotations rather than a second MCP implementation that can drift.
export const SERVER_INSTRUCTIONS = `Use the textbook workflow in order: read the authoring view and passages; create or resume a changeset; make semantic drafts; preview; inspect history; and commit live only after explicit user save or publish language. commit_live performs server-side validation. Every mutation needs its current base revision, changeset, and idempotency key. Never send raw HTML, CSS, SQL, or database patches.`;
export const TOOL_SAFETY = Object.freeze({
  read: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  mutate: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  dangerous: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
});

const rawPatchKeys = ["html", "css", "sql", "databasePatch", "rawPatch", "patch"];
export function refuseRaw(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  if (rawPatchKeys.some((key) => key in input)) throw new Error("Raw HTML, CSS, SQL, database, and patch inputs are refused; use a named semantic operation.");
}

export type ContentApiClientOptions = { baseUrl: string; bearerToken: string; fetch?: typeof globalThis.fetch };
export class ContentApiClient {
  private readonly fetcher: typeof fetch;
  constructor(private readonly options: ContentApiClientOptions) { this.fetcher = options.fetch ?? fetch; }
  get bearerToken() { return this.options.bearerToken; }

  async forward(request: Request) {
    const source = new URL(request.url);
    const target = new URL(`${source.pathname}${source.search}`, this.options.baseUrl);
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${this.options.bearerToken}`);
    return this.fetcher(target, { method: request.method, headers, body: request.body, duplex: request.body ? "half" : undefined } as RequestInit);
  }

  async request(path: string, init: RequestInit & { body?: unknown } = {}) {
    const encodedBody = init.body === undefined ? undefined : JSON.stringify(init.body);
    const response = await this.fetcher(new URL(path, this.options.baseUrl), {
      ...init,
      body: encodedBody,
      headers: { accept: "application/json", ...(encodedBody ? { "content-type": "application/json" } : {}), authorization: `Bearer ${this.options.bearerToken}`, ...init.headers },
    });
    const payload = await response.json().catch(() => ({ error: { code: "INVALID_UPSTREAM_RESPONSE", message: "Content API returned non-JSON" } }));
    if (!response.ok) throw new Error(`${response.status} ${payload?.error?.code ?? "CONTENT_API_ERROR"}: ${payload?.error?.message ?? "Request failed"}`);
    return payload;
  }
}

export type CapabilityVerifier = { verifyCapability(token: string, target: Record<string, unknown>): Promise<unknown> };
export async function createTextbookMcp(client: ContentApiClient, verifier: CapabilityVerifier, requestId = randomUUID()) {
  const identity = await verifyCapability({ AUTH_CAPABILITY: verifier }, client.bearerToken);
  return createMcp({ CONTENT_API: { fetch: (request: Request) => client.forward(request) }, AUTH_CAPABILITY: verifier }, requestId, { identity, bearerToken: client.bearerToken });
}

export async function start() {
  throw new Error("Use the hosted MCP Worker. The Node bridge cannot safely reach the private AUTH_CAPABILITY verifier and will not bypass it with a shared secret or public verification URL.");
}

if (process.argv[1]?.endsWith("server.ts")) start();
