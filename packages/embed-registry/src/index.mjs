const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const X_STATUS_ID = /^\d{5,25}$/;
const X_USER = /^[A-Za-z0-9_]{1,15}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const BLUESKY_USER = /^[a-z0-9][a-z0-9.-]{1,251}$/;

export class EmbedPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EmbedPolicyError";
    this.code = code;
  }
}

export const providerRegistry = Object.freeze({
  youtube: Object.freeze({
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"],
    renderer: "iframe",
    activation: "click",
    frameOrigin: "https://www.youtube-nocookie.com",
    sandbox: "allow-scripts allow-same-origin allow-presentation",
    allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share",
  }),
  vimeo: Object.freeze({
    hosts: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
    renderer: "iframe",
    activation: "click",
    frameOrigin: "https://player.vimeo.com",
    sandbox: "allow-scripts allow-same-origin allow-presentation",
    allow: "autoplay; fullscreen; picture-in-picture",
  }),
  x: Object.freeze({
    hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"],
    renderer: "official-widget-or-fallback",
    activation: "explicit-consent",
    scriptOrigin: "https://platform.x.com",
  }),
  spotify: Object.freeze({ hosts: ["open.spotify.com"], renderer: "iframe", activation: "explicit-consent", frameOrigin: "https://open.spotify.com", sandbox: "allow-scripts allow-same-origin allow-presentation" }),
  soundcloud: Object.freeze({ hosts: ["soundcloud.com", "www.soundcloud.com", "on.soundcloud.com"], renderer: "link-first", activation: "explicit-consent" }),
  bluesky: Object.freeze({ hosts: ["bsky.app", "www.bsky.app"], renderer: "link-first", activation: "explicit-consent" }),
});

function httpsUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new EmbedPolicyError("invalid_url", "Enter a complete supported https URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new EmbedPolicyError("unsafe_url", "Embed URLs must use https without credentials or a custom port.");
  }
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  return url;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new EmbedPolicyError("fallback_required", `${field} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new EmbedPolicyError("fallback_too_long", `${field} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

function authoredFallback(value) {
  if (!value || typeof value !== "object") {
    throw new EmbedPolicyError("fallback_required", "Every embed needs an instructor-authored fallback.");
  }
  return {
    title: requiredText(value.title, "Fallback title", 180),
    summary: requiredText(value.summary, "Fallback summary", 1200),
    sourceLabel: requiredText(value.sourceLabel, "Fallback source label", 100),
  };
}

function boundedInteger(value, name, maximum = 86_400) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new EmbedPolicyError("invalid_option", `${name} must be a whole number from 0 through ${maximum}.`);
  }
  return value;
}

function normalizeYouTube(url, options) {
  let videoId = "";
  if (url.hostname === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  else if (url.pathname === "/watch") videoId = url.searchParams.get("v") ?? "";
  else {
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)$/);
    videoId = match?.[1] ?? "";
  }
  if (!YOUTUBE_ID.test(videoId)) throw new EmbedPolicyError("unsupported_youtube_url", "Use a public YouTube video URL.");
  const startSeconds = boundedInteger(options.startSeconds, "YouTube start time");
  const language = options.captionLanguage === undefined
    ? undefined
    : requiredText(options.captionLanguage, "Caption language", 35);
  return {
    provider: "youtube",
    identity: { provider: "youtube", resourceType: "video", videoId },
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    render: {
      mode: "click-to-load",
      iframeOrigin: providerRegistry.youtube.frameOrigin,
      sandbox: providerRegistry.youtube.sandbox,
      allow: providerRegistry.youtube.allow,
      startSeconds,
      captions: options.captions !== false,
      captionLanguage: language,
    },
    activationDisclosure: "Loading this video contacts YouTube. YouTube may receive device and network information.",
  };
}

function normalizeVimeo(url, options) {
  const segments = url.pathname.split("/").filter(Boolean);
  const videoId = [...segments].reverse().find((segment) => VIMEO_ID.test(segment)) ?? "";
  if (!VIMEO_ID.test(videoId)) throw new EmbedPolicyError("unsupported_vimeo_url", "Use a public Vimeo video URL.");
  return {
    provider: "vimeo",
    identity: { provider: "vimeo", resourceType: "video", videoId },
    canonicalUrl: `https://vimeo.com/${videoId}`,
    render: {
      mode: "click-to-load",
      iframeOrigin: providerRegistry.vimeo.frameOrigin,
      sandbox: providerRegistry.vimeo.sandbox,
      allow: providerRegistry.vimeo.allow,
      dnt: true,
      startSeconds: boundedInteger(options.startSeconds, "Vimeo start time"),
    },
    activationDisclosure: "Loading this video contacts Vimeo. Do Not Track reduces Vimeo session analytics but does not make the player cookie-free.",
  };
}

function normalizeX(url) {
  const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)(?:\/.*)?$/);
  const username = match?.[1] ?? "";
  const statusId = match?.[2] ?? "";
  if (!X_USER.test(username) || !X_STATUS_ID.test(statusId)) {
    throw new EmbedPolicyError("unsupported_x_url", "Use the canonical URL for one public X post.");
  }
  return {
    provider: "x",
    identity: { provider: "x", resourceType: "post", statusId, username },
    canonicalUrl: `https://x.com/${username}/status/${statusId}`,
    render: {
      mode: "fallback-until-explicit-activation",
      officialWidgetAllowed: true,
      timeoutMs: 8_000,
      restoreFallbackOnFailure: true,
    },
    activationDisclosure: "Loading the live post runs X's official widget and contacts X. The readable fallback remains available if loading fails.",
  };
}
function normalizeSpotify(url) { const match = url.pathname.match(/^\/(track|album|playlist|episode|show)\/([A-Za-z0-9]{22})$/); if (!match || !SPOTIFY_ID.test(match[2])) throw new EmbedPolicyError("unsupported_spotify_url", "Use a canonical Spotify track, album, playlist, episode, or show URL."); return { provider: "spotify", identity: { provider: "spotify", resourceType: match[1], resourceId: match[2] }, canonicalUrl: `https://open.spotify.com/${match[1]}/${match[2]}`, render: { mode: "fallback-until-explicit-activation", iframeOrigin: providerRegistry.spotify.frameOrigin, sandbox: providerRegistry.spotify.sandbox, restoreFallbackOnFailure: true }, activationDisclosure: "Loading this player contacts Spotify. The instructor-authored fallback remains available." }; }
function normalizeSoundCloud(url) { if (url.hostname === "on.soundcloud.com" || url.pathname.split("/").filter(Boolean).length < 2) throw new EmbedPolicyError("unsupported_soundcloud_url", "Use a canonical public SoundCloud creator and track URL, not a short link."); return { provider: "soundcloud", identity: { provider: "soundcloud", resourceType: "track", resourceId: url.pathname }, canonicalUrl: `https://soundcloud.com${url.pathname}`, render: { mode: "link-first", restoreFallbackOnFailure: true }, activationDisclosure: "Opening this link contacts SoundCloud. The textbook does not load a SoundCloud widget automatically." }; }
function normalizeBluesky(url) { const match = url.pathname.match(/^\/profile\/([^/]+)\/post\/([a-z0-9]+)$/i); if (!match || !BLUESKY_USER.test(match[1])) throw new EmbedPolicyError("unsupported_bluesky_url", "Use a canonical public Bluesky post URL."); return { provider: "bluesky", identity: { provider: "bluesky", resourceType: "post", resourceId: `${match[1]}/${match[2]}` }, canonicalUrl: `https://bsky.app/profile/${match[1]}/post/${match[2]}`, render: { mode: "link-first", restoreFallbackOnFailure: true }, activationDisclosure: "Opening this link contacts Bluesky. The textbook does not load a Bluesky widget automatically." }; }

export function resolveEmbed(input, { fallback, options = {} } = {}) {
  const url = httpsUrl(input);
  const host = url.hostname;
  let definition;
  if (providerRegistry.youtube.hosts.includes(host)) definition = normalizeYouTube(url, options);
  else if (providerRegistry.vimeo.hosts.includes(host)) definition = normalizeVimeo(url, options);
  else if (providerRegistry.x.hosts.includes(host)) definition = normalizeX(url);
  else if (providerRegistry.spotify.hosts.includes(host)) definition = normalizeSpotify(url);
  else if (providerRegistry.soundcloud.hosts.includes(host)) definition = normalizeSoundCloud(url);
  else if (providerRegistry.bluesky.hosts.includes(host)) definition = normalizeBluesky(url);
  else throw new EmbedPolicyError("unsupported_provider", "This URL can be saved as an instructor-authored link card, but it cannot run as an embed.");

  return {
    schemaVersion: 1,
    kind: "externalEmbed",
    ...definition,
    fallback: { ...authoredFallback(fallback), href: definition.canonicalUrl },
    privacy: {
      requestBeforeActivation: false,
      studentTrackingAddedByTextbook: false,
    },
  };
}

export function createRichLinkCard(input, { title, summary, sourceLabel, imageMediaVersionId } = {}) {
  const url = httpsUrl(input);
  return {
    schemaVersion: 1,
    kind: "richLink",
    href: url.href,
    title: requiredText(title, "Link title", 180),
    summary: requiredText(summary, "Link summary", 1200),
    sourceLabel: requiredText(sourceLabel, "Link source label", 100),
    imageMediaVersionId: imageMediaVersionId === undefined
      ? undefined
      : requiredText(imageMediaVersionId, "Link image version", 160),
    metadataSource: "instructor",
    activeContent: false,
  };
}
