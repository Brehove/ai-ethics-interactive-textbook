const SECURITY_HEADERS = Object.freeze({
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://ethicsandai.your-digital-life.org; connect-src 'self' https://auth.ethicsandai.your-digital-life.org; frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://open.spotify.com; base-uri 'none'; form-action 'self' https://auth.ethicsandai.your-digital-life.org; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});

const secured = (response) => {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (headers.get("content-type")?.includes("text/html")) headers.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") return secured(new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } }));
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);
    if (response.status === 404 && (/^\/chapter\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(url.pathname) || url.pathname === "/agent-access")) {
      response = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }
    return secured(response);
  },
};
