import { CHAPTER_ROUTES } from "./chapter-routes.mjs";

const chapterByDocumentId = new Map(Object.entries(CHAPTER_ROUTES).map(([slug, route]) => [route.documentId, { slug, ...route }]));

const chapterRoute = (pathname) => {
  const match = pathname.match(/^\/chapter\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  return match ? CHAPTER_ROUTES[match[1]] || null : null;
};

const publicProjection = async (env, documentId) => {
  if (!env.PUBLIC_PROJECTION?.fetch) return null;
  try {
    const response = await env.PUBLIC_PROJECTION.fetch(new Request(`https://public-projection.internal/v1/public/chapters/${documentId}`, { headers: { accept: "application/json" } }));
    if (!response.ok) return null;
    const payload = await response.json();
    if (payload?.documentId !== documentId || typeof payload.html !== "string" || !Array.isArray(payload.prompts) || !/^revision_[A-Za-z0-9_-]+$/.test(payload.revisionId || "") || !/^projection_[A-Za-z0-9_-]+$/.test(payload.projectionId || "")) return null;
    return payload;
  } catch { return null; }
};

// This identity is exposed only through the Worker's named RPC entrypoint. It
// binds a document to the exact public route compiled into this reader and to
// the live immutable projection the reader would render there.
export const getReaderDeliveryIdentity = async (env, documentId) => {
  const route = chapterByDocumentId.get(documentId);
  if (!route) return null;
  const projection = await publicProjection(env, documentId);
  if (!projection) return null;
  return {
    documentId,
    slug: route.slug,
    publicPath: `/chapter/${route.slug}/`,
    revisionId: projection.revisionId,
    projectionId: projection.projectionId,
    projectionHash: projection.projectionHash,
  };
};

const projectionHeaders = (headers, projection) => {
  const next = new Headers(headers);
  next.set("x-content-revision", projection.revisionId);
  next.set("x-content-projection", projection.projectionId);
  next.set("x-content-projection-hash", projection.projectionHash);
  next.set("cache-control", "public, max-age=0, must-revalidate");
  return next;
};

const publicMedia = async (request, env, hash) => {
  if (!env.PUBLIC_PROJECTION?.fetch) return null;
  try {
    const headers = new Headers();
    for (const name of ["accept", "if-none-match", "range", "if-range"]) {
      const value = request.headers.get(name); if (value) headers.set(name, value);
    }
    return await env.PUBLIC_PROJECTION.fetch(new Request(`https://public-projection.internal/v1/public/assets/${hash}`, { method: request.method, headers }));
  } catch { return null; }
};

export const injectPublicProjection = (html, route, projection) => {
  const bodyPattern = new RegExp(`(<[^>]+data-public-projection=["']${route.documentId}["'][^>]*>)[\\s\\S]*?(<\\/div>\\s*<template[^>]+data-public-projection-end=["']${route.documentId}["'][^>]*><\\/template>)`);
  const body = html.replace(bodyPattern, `$1${projection.html}$2`);
  if (body === html) throw new Error("Public projection boundary is missing or malformed");
  return body.replace(new RegExp(`(<[^>]+data-reading-record[^>]+data-document-id=["']${route.documentId}["'][^>]*)(>)`), (_match, start, end) => `${start} data-prompts="${String(JSON.stringify(projection.prompts)).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}" data-chapter-version="${projection.revisionId}"${end}`);
};

const transformWithHtmlRewriter = (response, route, projection) => new HTMLRewriter()
  .on(`[data-public-projection="${route.documentId}"]`, {
    element(element) {
      element.setInnerContent(projection.html, { html: true });
      element.setAttribute("data-content-revision", projection.revisionId);
      element.setAttribute("data-content-projection", projection.projectionId);
    },
  })
  .on(`[data-reading-record][data-document-id="${route.documentId}"]`, {
    element(element) {
      element.setAttribute("data-prompts", JSON.stringify(projection.prompts));
      element.setAttribute("data-chapter-version", projection.revisionId);
    },
  })
  .transform(new Response(response.body, { status: response.status, statusText: response.statusText, headers: projectionHeaders(response.headers, projection) }));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if ((request.method === "GET" || request.method === "HEAD") && /^\/admin\/?$/.test(url.pathname)) {
      const target = new URL("https://auth.ethicsandai.your-digital-life.org/auth/start");
      target.searchParams.set("chapter", "what-are-you-becoming-aristotle-character-and-ai-assisted-life");
      target.searchParams.set("mode", "edit");
      return Response.redirect(target.toString(), 302);
    }
    const mediaMatch = url.pathname.match(/^\/media\/([a-f0-9]{64})$/);
    if ((request.method === "GET" || request.method === "HEAD") && mediaMatch) {
      const response = await publicMedia(request, env, mediaMatch[1]);
      return response || new Response("Public media is unavailable", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    }
    const route = chapterRoute(url.pathname);
    const deliveryProbe = request.method === "GET" && route && request.headers.get("x-textbook-delivery-probe") === "v1";
    // The probe is a Worker-to-Worker control signal, not an asset request
    // variant. Strip it before resolving the immutable deployed chapter shell
    // so service bindings and the public custom domain exercise the same asset.
    const assetRequest = deliveryProbe
      ? new Request(request.url, { method: "GET", headers: { accept: "text/html" } })
      : request;
    const staticResponse = await env.ASSETS.fetch(assetRequest);
    if (deliveryProbe) {
      if (!staticResponse.ok || !staticResponse.headers.get("content-type")?.includes("text/html")) {
        return new Response("Public chapter asset is unavailable", { status: 503, headers: { "cache-control": "no-store" } });
      }
      const projection = await publicProjection(env, route.documentId);
      if (!projection) return new Response("Public projection is unavailable", { status: 503, headers: { "cache-control": "no-store" } });
      try {
        injectPublicProjection(await staticResponse.text(), route, projection);
      } catch {
        return new Response("Public chapter projection could not be rendered", { status: 503, headers: { "cache-control": "no-store" } });
      }
      const headers = projectionHeaders(new Headers({ "cache-control": "no-store" }), projection);
      headers.set("cache-control", "no-store");
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET" && request.method !== "HEAD") return staticResponse;
    if (!route || request.method === "HEAD" || !staticResponse.ok || !staticResponse.headers.get("content-type")?.includes("text/html")) return staticResponse;
    const projection = await publicProjection(env, route.documentId);
    if (!projection) return staticResponse;
    if (typeof HTMLRewriter !== "undefined") return transformWithHtmlRewriter(staticResponse, route, projection);
    const html = await staticResponse.text();
    return new Response(injectPublicProjection(html, route, projection), { status: staticResponse.status, headers: projectionHeaders(staticResponse.headers, projection) });
  },
};
