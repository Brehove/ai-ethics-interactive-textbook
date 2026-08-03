import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcp } from "../../../workers/textbook-mcp/src/index.mjs";

// This optional Node bridge deliberately reuses the deployed Worker's tool
// registry. There is one set of semantic operation schemas, media tools, and
// safety annotations rather than a second MCP implementation that can drift.
export const SERVER_INSTRUCTIONS = `Use the textbook workflow in order: read a chapter and passages; create or resume a changeset; make semantic drafts; validate; diff; submit; approve; publish. Every mutation needs its current base revision, changeset, and idempotency key. Never send raw HTML, CSS, SQL, or database patches. Publish and rollback have real-world effects; obtain explicit confirmation.`;
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

export function createTextbookMcp(client: ContentApiClient, requestId = randomUUID()) {
  return createMcp({ CONTENT_API: { fetch: (request: Request) => client.forward(request) } }, requestId);
}

export async function start() {
  const baseUrl = process.env.CONTENT_API_URL;
  const bearerToken = process.env.CONTENT_API_BEARER_TOKEN;
  if (!baseUrl || !bearerToken) throw new Error("CONTENT_API_URL and CONTENT_API_BEARER_TOKEN are required; the URL must be an authenticated content gateway.");
  const mcp = createTextbookMcp(new ContentApiClient({ baseUrl, bearerToken }));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
  await mcp.connect(transport);
  const port = Number(process.env.PORT ?? 8788);
  createServer(async (req, res) => {
    if (req.url?.split("?")[0] !== "/mcp") { res.writeHead(404).end(); return; }
    await transport.handleRequest(req, res);
  }).listen(port);
}

if (process.argv[1]?.endsWith("server.ts")) start();
