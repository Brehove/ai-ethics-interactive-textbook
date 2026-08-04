const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

const DOCUMENT_ID = /^chapter_ch(?:0[1-9]|1[0-8])$/;
const ASSET_HASH = /^[a-f0-9]{64}$/;
const fail = (status, code, message) => new Response(JSON.stringify({ error: { code, message } }), { status, headers: JSON_HEADERS });

export const PUBLIC_PROJECTION_QUERY = `SELECT h.document_id, h.revision_id, h.projection_id, h.projection_hash,
  h.stylesheet_version, h.updated_at, p.slug, p.title, p.html, p.prompts_json
  FROM public_chapter_heads h
  JOIN public_chapter_projections p ON p.id = h.projection_id
  WHERE h.document_id = ? AND p.document_id = h.document_id AND p.revision_id = h.revision_id`;
export const PUBLIC_FLAG_QUERY = `SELECT enabled, document_ids_json, version FROM public_runtime_feature_flags WHERE name = ?`;

export const readPublicProjection = async (env, documentId) => {
  if (env.RUNTIME_FLAGS_ENFORCED === "1") {
    const flag = await env.PUBLIC_CONTENT_DB.prepare(PUBLIC_FLAG_QUERY).bind("server_public_projection").first();
    let targets;
    try { targets = JSON.parse(flag?.document_ids_json ?? "null"); } catch { targets = null; }
    if (flag?.enabled !== 1 || !Array.isArray(targets) || !targets.includes(documentId)) return null;
  }
  const row = await env.PUBLIC_CONTENT_DB.prepare(PUBLIC_PROJECTION_QUERY).bind(documentId).first();
  if (!row) return null;
  let prompts;
  try { prompts = JSON.parse(row.prompts_json); } catch { throw new Error("Public projection prompts are invalid"); }
  if (!Array.isArray(prompts)) throw new Error("Public projection prompts are invalid");
  return {
    schemaVersion: 1,
    documentId: row.document_id,
    revisionId: row.revision_id,
    projectionId: row.projection_id,
    projectionHash: row.projection_hash,
    stylesheetVersion: row.stylesheet_version,
    updatedAt: row.updated_at,
    slug: row.slug,
    title: row.title,
    html: row.html,
    prompts,
  };
};

export const PUBLIC_ASSET_QUERY = `SELECT sha256, object_key, bytes, mime_type
  FROM public_media_assets WHERE sha256 = ?`;

const publicAsset = async (request, env, hash) => {
  if (!env.PUBLIC_CONTENT_DB || !env.PUBLIC_MEDIA) return fail(503, "ASSET_UNAVAILABLE", "Public media delivery is unavailable");
  const asset = await env.PUBLIC_CONTENT_DB.prepare(PUBLIC_ASSET_QUERY).bind(hash).first();
  if (!asset || asset.sha256 !== hash || !asset.object_key?.startsWith("media/") || asset.object_key.includes("..") || !Number.isInteger(asset.bytes) || asset.bytes < 1) return fail(404, "ASSET_NOT_FOUND", "Public media was not found");
  if (request.headers.get("if-none-match")?.replace(/^W\//, "") === `\"${hash}\"`) return new Response(null, { status: 304, headers: { "cache-control": "public, max-age=31536000, immutable", etag: `\"${hash}\"`, "x-content-sha256": hash } });
  const object = await env.PUBLIC_MEDIA.get(asset.object_key, { onlyIf: request.headers, range: request.headers });
  if (!object) return fail(503, "ASSET_BYTES_UNAVAILABLE", "Published media bytes are unavailable");
  if (Number.isFinite(object.size) && object.size !== asset.bytes) return fail(503, "ASSET_INTEGRITY_ERROR", "Published media size failed integrity verification");
  const metadataHash = object.customMetadata?.sha256;
  if (metadataHash && metadataHash !== hash) return fail(503, "ASSET_INTEGRITY_ERROR", "Published media hash metadata failed integrity verification");
  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  headers.set("content-type", asset.mime_type);
  const range = object.range;
  headers.set("accept-ranges", "bytes");
  headers.set("content-length", String(range ? range.length : asset.bytes));
  if (range) headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${asset.bytes}`);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", `\"${hash}\"`);
  headers.set("x-content-sha256", hash);
  headers.set("x-content-type-options", "nosniff");
  headers.set("access-control-allow-origin", "https://editor.ethicsandai.your-digital-life.org");
  headers.set("cross-origin-resource-policy", "same-site");
  return new Response(request.method === "HEAD" ? null : object.body, { status: range ? 206 : 200, headers });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetMatch = url.pathname.match(/^\/v1\/public\/assets\/([a-f0-9]{64})$/);
    if ((request.method === "GET" || request.method === "HEAD") && assetMatch && ASSET_HASH.test(assetMatch[1])) {
      return publicAsset(request, env, assetMatch[1]);
    }
    const match = url.pathname.match(/^\/v1\/public\/chapters\/([^/]+)$/);
    if (request.method !== "GET" || !match) return fail(404, "NOT_FOUND", "Public projection route not found");
    const documentId = decodeURIComponent(match[1]);
    if (!DOCUMENT_ID.test(documentId)) return fail(404, "NOT_FOUND", "Public projection route not found");
    if (!env.PUBLIC_CONTENT_DB) return fail(503, "PROJECTION_UNAVAILABLE", "Public projection store is unavailable");
    try {
      const projection = await readPublicProjection(env, documentId);
      if (!projection) return fail(404, "PROJECTION_NOT_FOUND", "No public projection is active for this chapter");
      return new Response(JSON.stringify(projection), {
        status: 200,
        headers: {
          ...JSON_HEADERS,
          "x-content-revision": projection.revisionId,
          "x-content-projection": projection.projectionId,
          "x-content-projection-hash": projection.projectionHash,
        },
      });
    } catch {
      return fail(503, "PROJECTION_INVALID", "Public projection failed integrity checks");
    }
  },
};
