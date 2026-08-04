#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const token = process.env.TEXTBOOK_MCP_ACCESS_TOKEN;
if (!token) throw new Error("TEXTBOOK_MCP_ACCESS_TOKEN is required");
const chapterId = process.env.TEXTBOOK_CHAPTER_ID || "chapter_ch07";
const restoreRevisionId = process.env.TEXTBOOK_RESTORE_REVISION_ID || "";
const existingCommitReceiptId = process.env.TEXTBOOK_EXISTING_COMMIT_RECEIPT_ID || "";
const transport = new StreamableHTTPClientTransport(new URL(process.env.TEXTBOOK_MCP_ORIGIN || "https://mcp.ethicsandai.your-digital-life.org/mcp"), {
  requestInit: { headers: { authorization: `Bearer ${token}` } },
});
const client = new Client({ name: "textbook-production-conformance", version: "1.0.0" });
const decode = (result) => {
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("MCP tool returned no JSON text result");
  const parsed = JSON.parse(text);
  if (result.isError) throw new Error(parsed?.error?.message || text);
  return parsed;
};

await client.connect(transport);
try {
  const tools = (await client.listTools()).tools.map((tool) => tool.name).sort();
  const required = ["get_authoring_view", "get_version_history", "search_media", "resolve_provider_url"];
  for (const name of required) if (!tools.includes(name)) throw new Error(`Missing production MCP tool: ${name}`);
  const view = decode(await client.callTool({ name: "get_authoring_view", arguments: { chapterId } }));
  const history = decode(await client.callTool({ name: "get_version_history", arguments: { chapterId, limit: 20, cursor: 0 } }));
  const media = decode(await client.callTool({ name: "search_media", arguments: { query: "Aristotle", kind: "image", limit: 10, cursor: 0 } }));
  const provider = decode(await client.callTool({ name: "resolve_provider_url", arguments: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", expectedProvider: "youtube" } }));
  const summary = {
    serverTools: tools.length,
    chapterId,
    revisionId: view.revisionId || view.chapter?.revisionId,
    historyCount: history.revisions?.length ?? history.items?.length ?? 0,
    mediaMatches: media.media?.length ?? media.items?.length ?? 0,
    resolvedProvider: provider.proposal?.identity?.provider ?? provider.identity?.provider ?? null,
  };
  if (existingCommitReceiptId) {
    if (!tools.includes("get_live_commit_status")) throw new Error("Missing production delivery-status tool");
    const delivery = decode(await client.callTool({ name: "get_live_commit_status", arguments: { chapterId, commitReceiptId: existingCommitReceiptId } }));
    if (delivery.deliveryStatus !== "verified" && !delivery.live) throw new Error(`Existing live commit was not publicly verified: ${delivery.deliveryStatus || "unknown"}`);
    summary.commitReceiptId = existingCommitReceiptId;
    summary.restoredAsRevisionId = delivery.revisionId;
    summary.deliveryStatus = delivery.deliveryStatus || "verified";
  }
  if (restoreRevisionId) {
    for (const name of ["restore_revision_as_draft", "commit_live", "get_live_commit_status"]) if (!tools.includes(name)) throw new Error(`Missing production restore tool: ${name}`);
    const restored = decode(await client.callTool({ name: "restore_revision_as_draft", arguments: { chapterId, revisionId: restoreRevisionId, title: `Restore ${restoreRevisionId} after production verification`, idempotencyKey: randomUUID() } }));
    const committed = decode(await client.callTool({ name: "commit_live", arguments: { changeSetId: restored.id, documentId: chapterId, baseRevisionId: restored.baseRevisionId, expectedVersion: restored.version, idempotencyKey: randomUUID(), operations: [] } }));
    let delivery = committed;
    for (let attempt = 0; attempt < 8 && delivery.deliveryStatus !== "verified" && !delivery.live; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      delivery = decode(await client.callTool({ name: "get_live_commit_status", arguments: { chapterId, commitReceiptId: committed.commitReceiptId } }));
    }
    if (delivery.deliveryStatus !== "verified" && !delivery.live) throw new Error(`Restored revision was not publicly verified: ${delivery.deliveryStatus || "unknown"}`);
    summary.restoredFromRevisionId = restoreRevisionId;
    summary.restoredAsRevisionId = committed.revisionId;
    summary.commitReceiptId = committed.commitReceiptId;
    summary.deliveryStatus = delivery.deliveryStatus || "verified";
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await client.close();
}
