import { CHAPTER_RENDERER_STYLES, renderChapterProjection } from '@ai-ethics/chapter-renderer';

const encoder = new TextEncoder();
const PUBLIC_READER_ORIGIN = 'https://ethicsandai.your-digital-life.org';
const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const sha256 = async (value) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const hmac = async (secret, value) => { const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))].map((byte) => byte.toString(16).padStart(2, '0')).join(''); };
const equal = (left, right) => { if (left.length !== right.length) return false; let mismatch = 0; for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i); return mismatch === 0; };
const fromBase64Url = (value) => atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));

const render = (snapshot) => {
  const chapter = snapshot.chapter || {}; const surface = snapshot.surface || 'web';
  const projection = renderChapterProjection(chapter, { context: 'editor', publicOrigin: PUBLIC_READER_ORIGIN });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Draft preview · ${esc(chapter.title || snapshot.documentId)}</title><style>:root{color-scheme:light;--ink:#19231d;--muted:#607067;--rule:#d8dfda;--paper:#fff;--accent:#275d46}*{box-sizing:border-box}body{margin:0;background:#eef1ee;color:var(--ink);font:17px/1.65 ui-serif,Georgia,serif}.banner{position:sticky;top:0;z-index:2;padding:.7rem 1rem;background:#14251d;color:#fff;font:600 14px/1.3 ui-sans-serif,system-ui}.meta{opacity:.75;margin-left:.5rem}main{width:min(760px,calc(100% - 2rem));margin:1rem auto 4rem;padding:clamp(1.25rem,5vw,4rem);background:var(--paper);box-shadow:0 12px 42px #16302218}h1,h2,h3{line-height:1.2;margin:2rem 0 .7rem}p,li{max-width:70ch}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--rule);padding:.5rem;text-align:left}pre{overflow:auto;padding:1rem;background:#17201b;color:#f5f7f5}a{color:#195a3c}@media(max-width:430px){main{width:100%;margin:0;padding:1rem;box-shadow:none}body{font-size:16px}}@media print{.banner{position:static;background:none;color:#000;border-bottom:1px solid #000}body,main{background:#fff;box-shadow:none;margin:0;width:auto}a[href]::after{content:" (" attr(href) ")";font-size:.8em}}${CHAPTER_RENDERER_STYLES}</style></head><body data-preview-surface="${esc(surface)}"><div class="banner">Protected draft preview <span class="meta">one-time · noindex · ${esc(surface)} · ${esc(snapshot.snapshotHash || snapshot.contentHash)}</span></div><main><h1>${esc(chapter.title || 'Untitled chapter')}</h1>${projection.html}</main></body></html>`;
};

const securityHeaders = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store, max-age=0', 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'content-security-policy': `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: ${PUBLIC_READER_ORIGIN}; frame-ancestors ${PUBLIC_READER_ORIGIN}; base-uri 'none'; form-action 'none'` };
const fail = (status, message) => new Response(`<!doctype html><title>Preview unavailable</title><p>${esc(message)}</p>`, { status, headers: securityHeaders });

export default { async fetch(request, env) {
  const url = new URL(request.url); if (request.method !== 'GET' || url.pathname !== '/preview') return fail(404, 'Preview not found.');
  const token = url.searchParams.get('token') || ''; const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2]) || typeof env.PREVIEW_TOKEN_SECRET !== 'string' || env.PREVIEW_TOKEN_SECRET.length < 32) return fail(401, 'Preview token is invalid.');
  if (!equal(await hmac(env.PREVIEW_TOKEN_SECRET, parts[1]), parts[2])) return fail(401, 'Preview token is invalid.');
  let payload; try { payload = JSON.parse(fromBase64Url(parts[1])); } catch { return fail(401, 'Preview token is invalid.'); }
  if (payload.v !== 1 || !/^preview_[a-f0-9]{24}$/.test(payload.jti || '') || !/^[a-f0-9]{64}$/.test(payload.sh || '') || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return fail(410, 'Preview token has expired.');
  const tokenHash = await sha256(token); const grant = await env.CONTENT_DB.prepare('SELECT id, snapshot_hash, r2_object_key, surface, expires_at, consumed_at FROM preview_grants WHERE token_hash = ?').bind(tokenHash).first();
  if (!grant || grant.id !== payload.jti || grant.snapshot_hash !== payload.sh || grant.consumed_at || Date.parse(grant.expires_at) <= Date.now()) return fail(410, 'Preview token has expired or was already used.');
  const consumedAt = new Date().toISOString(); const update = await env.CONTENT_DB.prepare('UPDATE preview_grants SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND expires_at > ?').bind(consumedAt, grant.id, consumedAt).run();
  if (!update?.meta?.changes) return fail(410, 'Preview token was already used.');
  if (grant.r2_object_key !== `previews/${payload.sh}.json`) return fail(500, 'Preview metadata is inconsistent.');
  const object = await env.CONTENT_SNAPSHOTS.get(grant.r2_object_key); if (!object) return fail(410, 'Preview snapshot is unavailable.'); const raw = await object.text();
  if (await sha256(raw) !== payload.sh) return fail(500, 'Preview snapshot failed its integrity check.');
  let snapshot; try { snapshot = JSON.parse(raw); } catch { return fail(500, 'Preview snapshot is invalid.'); }
  snapshot.snapshotHash = payload.sh; return new Response(render(snapshot), { headers: securityHeaders });
} };
