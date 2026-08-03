import assert from "node:assert/strict";
import test from "node:test";
import { EmbedPolicyError, createRichLinkCard, resolveEmbed } from "../src/index.mjs";

const fallback = {
  title: "An authored title",
  summary: "The instructor's summary preserves the relevant teaching point without the provider.",
  sourceLabel: "External source",
};

test("normalizes YouTube variants to a privacy-enhanced click-to-load definition", () => {
  const result = resolveEmbed("https://youtu.be/dQw4w9WgXcQ?si=tracker", { fallback, options: { startSeconds: 42 } });
  assert.equal(result.provider, "youtube");
  assert.equal(result.identity.videoId, "dQw4w9WgXcQ");
  assert.equal(result.canonicalUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(result.render.iframeOrigin, "https://www.youtube-nocookie.com");
  assert.equal(result.privacy.requestBeforeActivation, false);
  assert.equal(JSON.stringify(result).includes("tracker"), false);
});

test("normalizes Vimeo with DNT and an honest disclosure", () => {
  const result = resolveEmbed("https://player.vimeo.com/video/123456789?h=tracking", { fallback });
  assert.equal(result.identity.videoId, "123456789");
  assert.equal(result.render.dnt, true);
  assert.match(result.activationDisclosure, /does not make the player cookie-free/);
});

test("normalizes legacy Twitter hosts to a canonical X post with fallback-first rendering", () => {
  const result = resolveEmbed("https://twitter.com/example_user/status/1234567890123456789?s=20", { fallback });
  assert.equal(result.provider, "x");
  assert.equal(result.identity.statusId, "1234567890123456789");
  assert.equal(result.canonicalUrl, "https://x.com/example_user/status/1234567890123456789");
  assert.equal(result.render.mode, "fallback-until-explicit-activation");
  assert.equal(result.render.restoreFallbackOnFailure, true);
});

test("requires an authored fallback for every provider embed", () => {
  assert.throws(
    () => resolveEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    (error) => error instanceof EmbedPolicyError && error.code === "fallback_required",
  );
});

test("rejects unsafe protocols, credentials, ports, and arbitrary providers", () => {
  const cases = [
    "http://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com:8443/watch?v=dQw4w9WgXcQ",
    "https://evil.example/embed/dQw4w9WgXcQ",
  ];
  for (const value of cases) assert.throws(() => resolveEmbed(value, { fallback }), EmbedPolicyError);
});

test("creates an instructor-authored inert link card without fetching its host", () => {
  const result = createRichLinkCard("https://example.edu/ethics?ref=course", {
    title: "Ethics case",
    summary: "A case for classroom analysis.",
    sourceLabel: "Example University",
  });
  assert.equal(result.kind, "richLink");
  assert.equal(result.metadataSource, "instructor");
  assert.equal(result.activeContent, false);
});

test("never accepts raw HTML as a URL", () => {
  assert.throws(() => resolveEmbed('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>', { fallback }), EmbedPolicyError);
});
test("Spotify, SoundCloud, and Bluesky preserve fallback-first activation", () => {
  assert.equal(resolveEmbed("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", { fallback }).render.mode, "fallback-until-explicit-activation");
  assert.equal(resolveEmbed("https://soundcloud.com/artist/track", { fallback }).render.mode, "link-first");
  assert.equal(resolveEmbed("https://bsky.app/profile/example.com/post/3kabc", { fallback }).render.mode, "link-first");
});
