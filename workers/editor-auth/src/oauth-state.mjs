import { randomBase64Url } from "./crypto.mjs";
import { HttpError } from "./policy.mjs";

const encoder = new TextEncoder();
const ANCHOR = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;
const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

const iso = (epochSeconds) => new Date(epochSeconds * 1000).toISOString();

function stateDb(env) {
  if (!env.AUTH_STATE_DB?.prepare) {
    throw new HttpError(503, "auth_state_unavailable", "The editor sign-in state is unavailable");
  }
  return env.AUTH_STATE_DB;
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function validateOAuthTarget(url, routeBySlug) {
  const accepted = new Set(["chapter", "mode", "anchor", "request"]);
  for (const [key] of url.searchParams) {
    if (!accepted.has(key)) throw new HttpError(400, "invalid_oauth_target", "The editor return target is invalid");
  }
  const chapter = url.searchParams.getAll("chapter");
  const mode = url.searchParams.getAll("mode");
  const anchor = url.searchParams.getAll("anchor");
  const request = url.searchParams.getAll("request");
  if (mode.length === 1 && mode[0] === "agent-access") {
    if (request.length !== 1 || chapter.length || anchor.length || !/^capreq_[A-Za-z0-9_-]{8,}$/.test(request[0])) {
      throw new HttpError(400, "invalid_oauth_target", "The agent approval target is invalid");
    }
    return Object.freeze({ requestId: request[0], mode: "agent-access" });
  }
  if (chapter.length !== 1 || mode.length !== 1 || anchor.length > 1 || request.length) {
    throw new HttpError(400, "invalid_oauth_target", "The editor return target is invalid");
  }
  const slug = chapter[0];
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !routeBySlug.has(slug)) {
    throw new HttpError(400, "invalid_oauth_target", "The requested chapter is not editable");
  }
  if (mode[0] !== "edit") throw new HttpError(400, "invalid_oauth_target", "The editor mode is invalid");
  const anchorId = anchor.length ? anchor[0] : undefined;
  if (anchorId !== undefined && (!anchorId || !ANCHOR.test(anchorId))) {
    throw new HttpError(400, "invalid_oauth_target", "The editor anchor is invalid");
  }
  return Object.freeze({ chapterSlug: slug, mode: "edit", ...(anchorId ? { anchorId } : {}) });
}

export function editorTargetUrl(editorOrigin, target) {
  if (target.mode === "agent-access") {
    const destination = new URL("/agent-access", editorOrigin);
    destination.searchParams.set("request", target.requestId);
    destination.searchParams.set("authenticated", "1");
    return destination.href;
  }
  const destination = new URL(`/chapter/${target.chapterSlug}/`, editorOrigin);
  destination.searchParams.set("mode", "edit");
  if (target.anchorId) destination.hash = target.anchorId;
  return destination.href;
}

export async function createOAuthState(target, env, nowSeconds, ttlSeconds, randomBytes) {
  const db = stateDb(env);
  const nonce = randomBase64Url(24, randomBytes);
  const verifier = randomBase64Url(48, randomBytes);
  if (!PKCE_VERIFIER.test(verifier)) throw new Error("Generated PKCE verifier is invalid");
  const expiresAt = iso(nowSeconds + ttlSeconds);
  try {
    await db.prepare(`INSERT INTO oauth_authorization_states
      (nonce_hash, pkce_verifier, chapter_slug, mode, anchor_id, issued_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      // The existing state table deliberately constrains mode to `edit`.
      // Agent approval is still cryptographically distinguished by the signed
      // target shape and request-prefixed chapter_slug, without a state-store
      // migration or an open redirect surface.
      .bind(await sha256Hex(nonce), verifier, target.chapterSlug ?? target.requestId, "edit", target.anchorId ?? null, iso(nowSeconds), expiresAt)
      .run();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "auth_state_unavailable", "The editor sign-in state is unavailable");
  }
  return { nonce, verifier, challenge: await pkceChallenge(verifier), expiresAt };
}

export async function consumeOAuthState(state, env, nowSeconds) {
  const db = stateDb(env);
  if (!state || typeof state.nonce !== "string" || !state.target || typeof state.target !== "object") {
    throw new HttpError(400, "state_expired", "The GitHub login state expired");
  }
  try {
    const row = await db.prepare(`DELETE FROM oauth_authorization_states
      WHERE nonce_hash = ? AND expires_at > ?
      RETURNING pkce_verifier, chapter_slug, mode, anchor_id, issued_at, expires_at`)
      .bind(await sha256Hex(state.nonce), iso(nowSeconds))
      .first();
    if (!row) throw new HttpError(400, "state_expired", "The GitHub login state expired or was already used");
    const target = state.target;
    const targetKey = target.chapterSlug ?? target.requestId;
    if (
      row.chapter_slug !== targetKey
      || row.mode !== "edit"
      || (row.anchor_id ?? undefined) !== (target.anchorId ?? undefined)
      || !PKCE_VERIFIER.test(row.pkce_verifier)
    ) {
      throw new HttpError(400, "state_expired", "The GitHub login state expired");
    }
    const returnedTarget = target.mode === "agent-access"
      ? { requestId: row.chapter_slug, mode: target.mode }
      : { chapterSlug: row.chapter_slug, mode: row.mode, ...(row.anchor_id ? { anchorId: row.anchor_id } : {}) };
    return Object.freeze({
      verifier: row.pkce_verifier,
      target: Object.freeze(returnedTarget),
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "auth_state_unavailable", "The editor sign-in state is unavailable");
  }
}

export async function cleanupExpiredOAuthStates(env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const db = stateDb(env);
  try {
    const result = await db.prepare("DELETE FROM oauth_authorization_states WHERE expires_at <= ?").bind(iso(nowSeconds)).run();
    return Number(result?.meta?.changes ?? 0);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "auth_state_unavailable", "The editor sign-in state is unavailable");
  }
}
