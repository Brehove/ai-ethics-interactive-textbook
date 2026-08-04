const encoder = new TextEncoder();

export const CHAPTER_RENDERER_STYLE_VERSION = "chapter-renderer-v1";
export const CHAPTER_RENDERER_STYLES = `
.chapter-managed{margin:2rem 0}
.chapter-checkpoint{border-left:4px solid var(--reader-accent,#8b341f);padding:1rem 1.2rem;background:var(--reader-panel,#f5f0e6)}
.chapter-media img{display:block;max-width:100%;height:auto;margin-inline:auto}
.chapter-media figcaption{margin-top:.65rem;color:var(--reader-muted,#596575)}
.chapter-embed__activation{font:inherit}
.chapter-person{display:grid;grid-template-columns:minmax(12rem,34%) 1fr;gap:clamp(1rem,3vw,2.5rem);padding:clamp(1rem,3vw,2rem);background:var(--reader-context,#e7f0f3);border-left:4px solid var(--reader-accent,#8b341f)}
.chapter-person__portrait img{width:100%;height:auto;display:block}
.chapter-person__label{font:700 .75rem/1.2 ui-sans-serif,system-ui;letter-spacing:.14em;text-transform:uppercase}
.chapter-person__credit{font-size:.8em}
@media(max-width:640px){.chapter-person{grid-template-columns:1fr}.chapter-person__portrait{max-width:18rem}}
@media print{.chapter-embed__activation{display:none}.chapter-managed{break-inside:avoid}}
`.trim();

export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
})[character]);

const safeHref = (value) => {
  if (typeof value !== "string") return null;
  if (/^\/(?!\/)/.test(value) || /^#[A-Za-z][A-Za-z0-9:_-]*$/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
};

const inline = (value = "") => {
  let rendered = escapeHtml(value);
  rendered = rendered.replace(/\[([^\]]+)\]\(((?:https:\/\/|\/(?!\/)|#)[^\s)]+)\)/g, (_match, label, href) => {
    const safe = safeHref(href); return safe ? `<a href="${escapeHtml(safe)}">${label}</a>` : label;
  });
  return rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\+\+([^+]+)\+\+/g, "<u>$1</u>");
};

const publicAssetUrl = (value, origin) => {
  if (!value || typeof value !== "string") return null;
  if (/^https:\/\//.test(value)) return safeHref(value);
  if (!value.startsWith("/")) return null;
  try { return new URL(value, origin || "https://ethicsandai.your-digital-life.org").toString(); } catch { return null; }
};

const passageId = (block) => block?.passageId || block?.anchorPassageId || null;
const domId = (value, prefix) => value ? String(value).replace(new RegExp(`^${prefix}_`), "") : null;
const orderOf = (value, fallback = 0) => {
  const candidate = value?.orderAtAnchor ?? value?.displayOrder;
  return Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
};

const featureFromRelation = (relation, person, anchorPassageId, displayOrder) => ({
  placementId: relation.placementId || `placement_${relation.entityId}_${anchorPassageId}`,
  personId: relation.entityId,
  anchorPassageId,
  displayOrder,
  featured: relation.featured !== false,
  ...(person || {}),
});

export function projectOrderedChapter(chapter, options = {}) {
  const blocks = Array.isArray(chapter?.body) ? chapter.body : [];
  const checkpoints = Array.isArray(chapter?.checkpoints) ? chapter.checkpoints : [];
  const managed = Array.isArray(chapter?.managedPlacements) ? chapter.managedPlacements : [];
  const frozenFeatures = new Map((Array.isArray(chapter?.personFeatures) ? chapter.personFeatures : [])
    .map((feature) => [feature.personFeatureId || feature.placementId, feature]));
  const people = options.persons || {};
  const after = new Map();
  const pushAfter = (anchor, node) => {
    if (!anchor) return;
    const list = after.get(anchor) || []; list.push(node); after.set(anchor, list);
  };

  checkpoints.forEach((value, index) => pushAfter(value.passageId, { kind: "checkpoint", value, order: orderOf(value, index), index }));
  managed.forEach((placement, index) => {
    if (placement.type !== "personFeature" && placement.kind !== "personFeature") return;
    const frozen = frozenFeatures.get(placement.contentId) || {};
    const personId = frozen.personId || placement.personId || placement.entityId;
    pushAfter(placement.anchorPassageId || placement.passageId, {
      kind: "personFeature",
      value: { ...(people[personId] || {}), ...frozen, ...placement, personId },
      order: orderOf(placement, index), index,
      position: placement.position || "after",
    });
  });

  // Backward compatibility is intentionally limited to the former explicit
  // `featured: true` relation shape. Contract-v2 relations are semantic links;
  // only managed placements decide whether a scholar card is rendered.
  const hasManagedPeople = managed.some((item) => item.type === "personFeature" || item.kind === "personFeature");
  if (!hasManagedPeople && Array.isArray(chapter?.people)) {
    chapter.people.forEach((relation, relationIndex) => {
      if (relation?.featured !== true) return;
      const anchors = Array.isArray(relation?.passageIds) ? relation.passageIds : [];
      anchors.forEach((anchor, anchorIndex) => pushAfter(anchor, {
        kind: "personFeature",
        value: featureFromRelation(relation, people[relation.entityId], anchor, relationIndex * 100 + anchorIndex),
        order: relationIndex * 100 + anchorIndex, index: relationIndex,
      }));
    });
  }

  const before = new Map();
  for (const [anchor, nodes] of after) {
    const beforeNodes = nodes.filter((node) => node.position === "before");
    if (beforeNodes.length) before.set(anchor, beforeNodes);
    after.set(anchor, nodes.filter((node) => node.position !== "before"));
  }
  const ordered = [];
  for (const block of blocks) {
    const anchoredBefore = before.get(passageId(block)) || [];
    anchoredBefore.sort((left, right) => left.order - right.order || left.index - right.index);
    ordered.push(...anchoredBefore.map(({ order: _order, index: _index, position: _position, ...node }) => node));
    ordered.push({ kind: "block", value: block });
    const anchored = after.get(passageId(block)) || [];
    anchored.sort((left, right) => left.order - right.order || left.index - right.index);
    ordered.push(...anchored.map(({ order: _order, index: _index, position: _position, ...node }) => node));
  }
  return ordered;
}

const decodeLegacy = (block) => {
  if (/_metadata$/.test(block.blockId || "")) return "";
  const match = String(block.sanitizedHtml || "").match(/^<pre data-content-source="git-markdown-v1">([\s\S]*)<\/pre>$/);
  const decoded = match ? match[1].replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", "\"").replaceAll("&#039;", "'").replaceAll("&amp;", "&") : String(block.sanitizedHtml || "");
  return decoded
    .replace(/<(script|style|form|iframe|object|embed|link|meta|base)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|form|iframe|object|embed|link|meta|base)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s(?:on[a-z]+|style|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(?:"(?!https:\/\/|\/|#)[^"]*"|'(?!https:\/\/|\/|#)[^']*')/gi, "");
};

const renderBlock = (block, options) => {
  const anchor = domId(passageId(block), "passage");
  const id = anchor ? ` id="${escapeHtml(anchor)}"` : "";
  const blockId = block.blockId ? ` data-content-block-id="${escapeHtml(block.blockId)}"` : "";
  const stablePassage = passageId(block) ? ` data-passage-id="${escapeHtml(passageId(block))}"` : "";
  if (block.type === "heading") { const level = Math.min(6, Math.max(2, Number(block.level) || 2)); return `<h${level} id="${escapeHtml(domId(block.sectionId, "section") || anchor || "")}"${blockId}${stablePassage}>${inline(block.text)}</h${level}>`; }
  if (block.type === "paragraph") return `<p${id}${blockId}${stablePassage}>${inline(block.text)}</p>`;
  if (block.type === "blockquote") return `<blockquote${id}${blockId}${stablePassage}>${inline(block.text).replaceAll("\n", "<br>")}</blockquote>`;
  if (block.type === "list") { const tag = block.ordered ? "ol" : "ul"; return `<${tag}${id}${blockId}${stablePassage}>${(block.items || []).map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`; }
  if (block.type === "codeBlock") return `<pre${id}${blockId}><code>${escapeHtml(block.code || block.text || "")}</code></pre>`;
  if (block.type === "table") return `<div class="table-wrap"${blockId}><table${id}><thead><tr>${(block.columns || []).map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${(block.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  if (block.type === "callout") return `<aside${id}${blockId} class="textbook shaded textbox--${escapeHtml(block.tone || "note")}" role="note"><p>${inline(block.text)}</p></aside>`;
  if (block.type === "legacyMarkup") return `<div${id}${blockId} data-locked-content="true">${decodeLegacy(block)}</div>`;
  if (block.type === "mediaFigure") return renderMedia(block, options);
  if (block.type === "externalEmbed" || block.type === "richLink") return renderEmbed(block, options);
  if (block.type === "diagram") return `<figure class="chapter-managed chapter-diagram"${blockId}><div data-diagram-id="${escapeHtml(block.diagramId || "")}">${escapeHtml(block.description || block.title || "Interactive diagram")}</div></figure>`;
  if (block.type === "personFeature") return renderPerson(block, options);
  return "";
};

const renderMedia = (block, options) => {
  const src = publicAssetUrl(block.src || block.derivativeUrl || block.posterUrl, options.publicOrigin);
  const caption = block.caption ? `<figcaption>${inline(block.caption)}</figcaption>` : "";
  const credit = block.creditOverride || block.credit;
  return `<figure class="chapter-managed chapter-media chapter-media--${escapeHtml(block.displayPreset || "reading")}" data-content-block-id="${escapeHtml(block.blockId || "")}" data-media-version-id="${escapeHtml(block.mediaVersionId || "")}">${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.decorative ? "" : block.alt || "")}"${block.decorative ? " aria-hidden=\"true\"" : ""}>` : `<div class="chapter-media__fallback" role="img" aria-label="${escapeHtml(block.alt || "Media preview")}">${escapeHtml(block.caption || "Media")}</div>`}${caption}${credit ? `<p class="chapter-media__credit">${inline(credit)}</p>` : ""}</figure>`;
};

const renderEmbed = (block) => {
  const url = safeHref(block.canonicalUrl);
  const title = block.title || block.fallback?.title || block.caption || "External resource";
  const summary = block.summary || block.fallback?.summary || block.teachingUse || "";
  const label = block.linkLabel || block.fallback?.linkLabel || "Open canonical source";
  const provider = block.identity?.provider || (block.type === "richLink" ? "link" : "external");
  return `<aside class="chapter-managed chapter-embed" data-content-block-id="${escapeHtml(block.blockId || "")}" data-embed-provider="${escapeHtml(provider)}"><strong>${escapeHtml(title)}</strong>${summary ? `<p>${inline(summary)}</p>` : ""}${url ? `<p><a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(label)}</a></p><button type="button" class="chapter-embed__activation" data-activate-embed="${escapeHtml(provider)}" data-provider-url="${escapeHtml(url)}">Activate ${escapeHtml(provider)} embed</button>` : ""}</aside>`;
};

const renderCheckpoint = (checkpoint) => `<aside class="chapter-managed chapter-checkpoint" data-checkpoint-id="${escapeHtml(checkpoint.checkpointId || "")}" data-passage-id="${escapeHtml(checkpoint.passageId || "")}"><strong>${escapeHtml(checkpoint.title || checkpoint.stage || "Prompt checkpoint")}</strong><p>${inline(checkpoint.prompt || "")}</p>${checkpoint.guidance ? `<p class="chapter-checkpoint__guidance">${inline(checkpoint.guidance)}</p>` : ""}</aside>`;

const renderPerson = (person, options) => {
  const portrait = publicAssetUrl(person.portraitUrl || person.portrait?.src || person.imageUrl, options.publicOrigin);
  const name = person.displayName || person.name || person.title || person.personId || "Scholar";
  const href = safeHref(person.href || person.profileUrl || (person.slug ? `/people/${person.slug}/` : null));
  const biography = person.biography || person.summary || person.teachingNote || person.teachingContext || "";
  const primarySources = Array.isArray(person.primarySources) ? person.primarySources : [];
  const primary = person.primarySource?.title || person.primaryTextTitle || primarySources[0]?.title;
  const credit = person.credit || person.portrait?.credit;
  const portraitAlt = person.portraitAlt || person.portrait?.alt || `Portrait of ${name}`;
  return `<aside class="chapter-managed chapter-person" data-person-feature-id="${escapeHtml(person.personFeatureId || person.placementId || "")}" data-person-id="${escapeHtml(person.personId || person.entityId || "")}"><div class="chapter-person__portrait">${portrait ? `<img src="${escapeHtml(portrait)}" alt="${escapeHtml(portraitAlt)}">` : ""}${credit ? `<p class="chapter-person__credit">${inline(credit)}</p>` : ""}</div><div class="chapter-person__body"><p class="chapter-person__label">${escapeHtml(person.label || "Thinker in the text")}</p><h3>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(name)}</a>` : escapeHtml(name)}</h3>${person.dates ? `<p>${escapeHtml(person.dates)}</p>` : ""}${person.role ? `<p><em>${escapeHtml(person.role)}</em></p>` : ""}${biography ? `<p>${inline(biography)}</p>` : ""}${primary ? `<p><strong>Primary text:</strong> ${escapeHtml(primary)}</p>` : ""}</div></aside>`;
};

export function renderOrderedNode(node, options = {}) {
  if (node.kind === "block") return renderBlock(node.value, options);
  if (node.kind === "checkpoint") return renderCheckpoint(node.value);
  if (node.kind === "personFeature") return renderPerson(node.value, options);
  return "";
}

export function renderChapterProjection(chapter, options = {}) {
  const orderedNodes = projectOrderedChapter(chapter, options);
  return {
    schemaVersion: 1,
    revisionId: chapter?.revisionId || null,
    chapterVersion: chapter?.chapterVersion || null,
    title: chapter?.title || "Untitled chapter",
    stylesheetVersion: CHAPTER_RENDERER_STYLE_VERSION,
    html: orderedNodes.map((node) => renderOrderedNode(node, options)).join("\n"),
    prompts: orderedNodes.filter((node) => node.kind === "checkpoint" && node.value.showInSidebar !== false).map((node) => ({ ...node.value })),
    orderedNodes,
  };
}

export const stripAuthorDecorations = (html = "") => String(html)
  .replace(/\sdata-author(?:-[a-z0-9-]+)?=(?:"[^"]*"|'[^']*')/gi, "")
  .replace(/\scontenteditable=(?:"[^"]*"|'[^']*')/gi, "")
  .replace(/\sdata-node-view-wrapper=(?:"[^"]*"|'[^']*')/gi, "");

export const normalizeRenderedHtml = (html = "") => stripAuthorDecorations(html)
  .replace(/>\s+</g, "><")
  .replace(/\s{2,}/g, " ")
  .trim();

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};

export const stableProjectionJson = (value) => JSON.stringify(canonical(value));
export async function projectionIdentity(value) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(stableProjectionJson(value)));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
