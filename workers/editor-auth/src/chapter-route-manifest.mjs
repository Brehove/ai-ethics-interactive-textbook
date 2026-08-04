// Generated from content/book.json by scripts/generate-editor-chapter-manifest.mjs.
// This deliberately contains routing metadata only; it is safe to bundle in the
// auth Worker and is the sole allowlist for OAuth editor-return targets.
export const CHAPTER_ROUTE_MANIFEST = Object.freeze([
  ["chapter_ch01", "practicing-philosophy"],
  ["chapter_ch02", "testing-moral-arguments"],
  ["chapter_ch03", "how-generative-ai-produces-answers"],
  ["chapter_ch04", "ai-as-an-interlocutor"],
  ["chapter_ch05", "divine-command-natural-law-moral-authority"],
  ["chapter_ch06", "commands-constitutions-and-alignment"],
  ["chapter_ch07", "aristotle-character-and-ai-assisted-life"],
  ["chapter_ch08", "practical-wisdom-after-aristotle"],
  ["chapter_ch09", "kantian-deontology"],
  ["chapter_ch10", "utilitarianism-consequences-rules-and-two-level-reasoning"],
  ["chapter_ch11", "from-data-trails-to-ai-systems"],
  ["chapter_ch12", "algorithmic-bias-and-the-ai-mirror"],
  ["chapter_ch13", "delegating-judgment"],
  ["chapter_ch14", "ai-companions-and-coexistence"],
  ["chapter_ch15", "creativity-innovation-and-ai"],
  ["chapter_ch16", "existential-risk-effective-altruism-and-future-stakes"],
  ["chapter_ch17", "accelerationism-ai-and-the-ethics-of-speed"],
  ["chapter_ch18", "transhumanism-enhancement-and-human-capacity"],
].map(([documentId, slug]) => Object.freeze({
  documentId,
  slug,
  publicPath: `/chapter/${slug}/`,
  editorPath: `/chapter/${slug}/`,
})));

export const CHAPTER_ROUTE_BY_SLUG = new Map(CHAPTER_ROUTE_MANIFEST.map((route) => [route.slug, route]));
