const encoder = new TextEncoder();

export const CHAPTER_RENDERER_STYLE_VERSION = "chapter-renderer-v4-card-ratios";
export const CHAPTER_RENDERER_STYLES = `
.chapter-flow{--reader-lane:44rem;--wide-lane:60rem;--full-lane:76rem}
.chapter-managed{margin:2rem auto;box-sizing:border-box}
.chapter-card[data-card-width="compact"]{max-width:16rem}.chapter-card[data-card-width="narrow"]{max-width:22rem}.chapter-card[data-card-width="medium"]{max-width:30rem}.chapter-card[data-card-width="reading"]{max-width:var(--reader-lane)}.chapter-card[data-card-width="wide"]{max-width:var(--wide-lane)}.chapter-card[data-card-width="full"]{max-width:var(--full-lane)}.chapter-card[data-card-width="bleed"]{max-width:none}
.chapter-card[data-card-align="start"]{margin-inline-start:0}.chapter-card[data-card-align="end"]{margin-inline-end:0}
.chapter-card[data-card-density="compact"]{--card-pad:.75rem}.chapter-card[data-card-density="standard"]{--card-pad:1.25rem}.chapter-card[data-card-density="expanded"]{--card-pad:2rem}
.chapter-card__frame{overflow:hidden}.chapter-card__frame img{width:100%;height:100%;display:block}.chapter-card__frame[data-frame-mode="contain"] img{object-fit:contain}.chapter-card__frame[data-frame-mode="crop"] img{object-fit:cover;aspect-ratio:var(--card-aspect);object-position:var(--card-focus,50% 50%)}
.chapter-layout{max-width:var(--full-lane);margin:2rem auto}.chapter-layout--wrap{display:flow-root}.chapter-layout--wrap>.chapter-card{width:min(var(--card-region-width,22rem),45%);margin-block:0 1rem}.chapter-layout--wrap[data-card-side="start"]>.chapter-card{float:left;margin-inline:0 1.5rem}.chapter-layout--wrap[data-card-side="end"]>.chapter-card{float:right;margin-inline:1.5rem 0}
.chapter-layout--card-text-split{display:grid;grid-template-columns:var(--split-columns,1fr 1fr);gap:clamp(1rem,3vw,2.5rem);align-items:start}.chapter-layout--card-text-split[data-card-side="start"] .chapter-layout__cards{grid-column:1}.chapter-layout--card-text-split[data-card-side="start"] .chapter-layout__text{grid-column:2}.chapter-layout--card-text-split[data-card-side="end"] .chapter-layout__cards{grid-column:2}.chapter-layout--card-text-split[data-card-side="end"] .chapter-layout__text{grid-column:1}.chapter-layout__cards,.chapter-layout__text{grid-row:1}.chapter-layout__cards{display:grid;gap:1rem}.chapter-layout--card-grid{display:grid;grid-template-columns:repeat(var(--grid-columns,2),minmax(0,1fr));gap:clamp(.85rem,2vw,1.5rem);align-items:start}.chapter-layout--card-grid[data-ratio="start-narrow"]{grid-template-columns:minmax(14rem,.7fr) minmax(0,1.3fr)}.chapter-layout--card-grid[data-ratio="end-narrow"]{grid-template-columns:minmax(0,1.3fr) minmax(14rem,.7fr)}.chapter-layout--card-grid>.chapter-card{margin:0;max-width:none}.chapter-layout--card-grid[data-emphasis="featured"]>.chapter-card[data-featured="true"]{grid-column:span 2}
.chapter-checkpoint{border-left:4px solid var(--reader-accent,#8b341f);padding:1rem 1.2rem;background:var(--reader-panel,#f5f0e6)}
.chapter-media img{display:block;max-width:100%;height:auto;margin-inline:auto}
.chapter-media figcaption{margin-top:.65rem;color:var(--reader-muted,#596575)}
.chapter-embed__activation{font:inherit}
.chapter-person{container-type:inline-size;padding:var(--card-pad,clamp(1rem,3vw,2rem));background:var(--reader-context,#e7f0f3);border-left:4px solid var(--reader-accent,#8b341f)}.chapter-person__content{display:grid;grid-template-columns:1fr;gap:clamp(1rem,3vw,2.5rem)}
.chapter-person__portrait img{width:100%;height:auto;display:block}
.chapter-person__label{font:700 .75rem/1.2 ui-sans-serif,system-ui;letter-spacing:.14em;text-transform:uppercase}
.chapter-person__credit{font-size:.8em}
.chapter-person__portrait{width:min(100%,18rem);margin-inline:auto}@container (min-width:26rem){.chapter-person__content{grid-template-columns:minmax(8rem,34%) 1fr}.chapter-person__portrait{width:auto;margin-inline:0}}
@media(max-width:720px){.chapter-layout--wrap>.chapter-card{float:none!important;width:auto;margin:1.5rem auto!important}.chapter-layout--card-text-split,.chapter-layout--card-grid{display:block}.chapter-layout--card-text-split .chapter-layout__cards,.chapter-layout--card-text-split .chapter-layout__text{margin-bottom:1.5rem}.chapter-person__content{grid-template-columns:1fr}.chapter-person__portrait{width:min(100%,18rem);margin-inline:auto}}
@media print{.chapter-embed__activation{display:none}.chapter-managed{break-inside:avoid}.chapter-layout{display:contents!important}.chapter-layout__cards,.chapter-layout__text{display:contents!important}.chapter-layout .chapter-card{float:none!important;width:auto!important;max-width:none!important;margin:1rem 0!important}.chapter-layout [data-featured]{grid-column:auto!important}}
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

const compareAnchoredNodes = (left, right) => {
  const orderDifference = left.order - right.order;
  if (orderDifference) return orderDifference;
  const kindDifference = (left.kind === "checkpoint" ? 0 : 1) - (right.kind === "checkpoint" ? 0 : 1);
  if (kindDifference) return kindDifference;
  const leftId = left.kind === "checkpoint" ? left.value.checkpointId : left.value.placementId || left.value.personFeatureId;
  const rightId = right.kind === "checkpoint" ? right.value.checkpointId : right.value.placementId || right.value.personFeatureId;
  return String(leftId || "").localeCompare(String(rightId || "")) || left.index - right.index;
};

const featureFromRelation = (relation, person, anchorPassageId, displayOrder) => ({
  placementId: relation.placementId || `placement_${relation.entityId}_${anchorPassageId}`,
  personId: relation.entityId,
  anchorPassageId,
  displayOrder,
  featured: relation.featured !== false,
  ...(person || {}),
});

export class ChapterFlowError extends Error {
  constructor(code, message, path = "body") {
    super(message);
    this.name = "ChapterFlowError";
    this.code = code;
    this.path = path;
  }
}

const projectV2OrderedChapter = (chapter, options = {}) => {
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
  const ownedPassages = new Set(blocks.map((block) => block?.passageId).filter(Boolean));
  const emittedBefore = new Set();
  const emittedAfter = new Set();
  for (const block of blocks) {
    const anchor = passageId(block);
    const ownsAnchor = Boolean(block?.passageId) || (anchor && !ownedPassages.has(anchor));
    const anchoredBefore = ownsAnchor && !emittedBefore.has(anchor) ? before.get(anchor) || [] : [];
    anchoredBefore.sort(compareAnchoredNodes);
    ordered.push(...anchoredBefore.map(({ order: _order, index: _index, position: _position, ...node }) => node));
    if (anchor && ownsAnchor) emittedBefore.add(anchor);
    ordered.push({ kind: "block", value: block });
    const anchored = ownsAnchor && !emittedAfter.has(anchor) ? after.get(anchor) || [] : [];
    anchored.sort(compareAnchoredNodes);
    ordered.push(...anchored.map(({ order: _order, index: _index, position: _position, ...node }) => node));
    if (anchor && ownsAnchor) emittedAfter.add(anchor);
  }
  const legacyPassageOrder = new Map((Array.isArray(chapter?.passages) ? chapter.passages : []).map((passage, index) => [passage?.passageId, index]));
  const unmatchedAnchors = [...new Set([...before.keys(), ...after.keys()])]
    .filter((anchor) => !emittedBefore.has(anchor) || !emittedAfter.has(anchor))
    .sort((left, right) => (legacyPassageOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (legacyPassageOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || String(left).localeCompare(String(right)));
  for (const anchor of unmatchedAnchors) {
    if (!emittedBefore.has(anchor)) {
      const anchoredBefore = before.get(anchor) || [];
      anchoredBefore.sort(compareAnchoredNodes);
      ordered.push(...anchoredBefore.map(({ order: _order, index: _index, position: _position, ...node }) => node));
    }
    if (!emittedAfter.has(anchor)) {
      const anchoredAfter = after.get(anchor) || [];
      anchoredAfter.sort(compareAnchoredNodes);
      ordered.push(...anchoredAfter.map(({ order: _order, index: _index, position: _position, ...node }) => node));
    }
  }
  return ordered;
};

const flowPassageId = (block) => block?.passageId || block?.anchorPassageId || null;
const nearestFlowPassage = (body, index) => {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (body[cursor]?.type === "checkpointRef" || body[cursor]?.type === "placementRef") continue;
    const passage = flowPassageId(body[cursor]);
    if (passage) return passage;
  }
  for (let cursor = index + 1; cursor < body.length; cursor += 1) {
    if (body[cursor]?.type === "checkpointRef" || body[cursor]?.type === "placementRef") continue;
    const passage = flowPassageId(body[cursor]);
    if (passage) return passage;
  }
  return null;
};

const projectV3OrderedChapter = (chapter, options = {}) => {
  const body = Array.isArray(chapter?.body) ? chapter.body : [];
  const checkpoints = new Map((Array.isArray(chapter?.checkpoints) ? chapter.checkpoints : []).map((value) => [value.checkpointId, value]));
  const placements = new Map((Array.isArray(chapter?.managedPlacements) ? chapter.managedPlacements : []).map((value) => [value.placementId, value]));
  const frozenFeatures = new Map((Array.isArray(chapter?.personFeatures) ? chapter.personFeatures : []).map((value) => [value.personFeatureId || value.placementId, value]));
  const seenCheckpoints = new Set();
  const seenPlacements = new Set();
  const ordered = [];

  body.forEach((node, index) => {
    if (node?.type === "checkpointRef") {
      const checkpoint = checkpoints.get(node.checkpointId);
      if (!checkpoint) throw new ChapterFlowError("CHECKPOINT_REFERENCE_MISSING", `Checkpoint reference ${node.checkpointId || "(missing)"} has no checkpoint record.`, `body.${index}.checkpointId`);
      if (seenCheckpoints.has(node.checkpointId)) throw new ChapterFlowError("CHECKPOINT_REFERENCE_DUPLICATE", `Checkpoint ${node.checkpointId} appears more than once in chapter flow.`, `body.${index}.checkpointId`);
      seenCheckpoints.add(node.checkpointId);
      ordered.push({ kind: "checkpoint", value: checkpoint });
      return;
    }
    if (node?.type === "placementRef") {
      const placement = placements.get(node.placementId);
      if (!placement) throw new ChapterFlowError("PLACEMENT_REFERENCE_MISSING", `Placement reference ${node.placementId || "(missing)"} has no placement record.`, `body.${index}.placementId`);
      if (seenPlacements.has(node.placementId)) throw new ChapterFlowError("PLACEMENT_REFERENCE_DUPLICATE", `Placement ${node.placementId} appears more than once in chapter flow.`, `body.${index}.placementId`);
      seenPlacements.add(node.placementId);
      if (placement.kind !== "personFeature") throw new ChapterFlowError("PLACEMENT_REFERENCE_TYPE_MISMATCH", `Placement ${node.placementId} is not a separately projected managed record.`, `managedPlacements.${node.placementId}.kind`);
      const frozen = frozenFeatures.get(placement.contentId);
      if (!frozen) throw new ChapterFlowError("PLACEMENT_CONTENT_MISSING", `Placement ${node.placementId} has no frozen person feature.`, `managedPlacements.${node.placementId}.contentId`);
      const person = options.persons?.[frozen.personId] || {};
      ordered.push({ kind: "personFeature", value: { ...person, ...frozen, ...placement } });
      return;
    }
    ordered.push({ kind: "block", value: node });
  });

  for (const checkpointId of checkpoints.keys()) if (!seenCheckpoints.has(checkpointId)) throw new ChapterFlowError("CHECKPOINT_REFERENCE_ORPHAN", `Checkpoint ${checkpointId} is not present in chapter flow.`, "checkpoints");
  for (const placementId of placements.keys()) if (!seenPlacements.has(placementId)) throw new ChapterFlowError("PLACEMENT_REFERENCE_ORPHAN", `Placement ${placementId} is not present in chapter flow.`, "managedPlacements");
  return ordered;
};

export function projectOrderedChapter(chapter, options = {}) {
  if (chapter?.schemaVersion === 2) return projectV2OrderedChapter(chapter, options);
  if (chapter?.schemaVersion === 3 || chapter?.schemaVersion === 4) return projectV3OrderedChapter(chapter, options);
  throw new ChapterFlowError("CONTENT_SCHEMA_VERSION_UNSUPPORTED", "Chapter schemaVersion must explicitly be 2, 3, or 4.", "schemaVersion");
}

/** Deterministically materialize the legacy anchor projection as schema-v3 flow. */
export function migrateChapterV2ToV3(chapter, options = {}) {
  if (chapter?.schemaVersion === 3) return structuredClone(chapter);
  if (chapter?.schemaVersion !== 2) throw new ChapterFlowError("CONTENT_SCHEMA_VERSION_UNSUPPORTED", "Only schema-v2 chapters can be migrated to schema v3.", "schemaVersion");
  const ordered = projectV2OrderedChapter(chapter, options);
  const migrated = structuredClone(chapter);
  migrated.schemaVersion = 3;
  migrated.body = ordered.map((node) => {
    if (node.kind === "checkpoint") return { type: "checkpointRef", checkpointId: node.value.checkpointId };
    if (node.kind === "personFeature") return { type: "placementRef", placementId: node.value.placementId };
    return structuredClone(node.value);
  });
  migrated.checkpoints = (migrated.checkpoints || []).map(({ displayOrder: _displayOrder, ...checkpoint }) => checkpoint);
  migrated.managedPlacements = (migrated.managedPlacements || []).map(({ position: _position, orderAtAnchor: _orderAtAnchor, ...placement }) => placement);
  // Validate the complete one-record/one-reference invariant before returning.
  projectV3OrderedChapter(migrated, options);
  return migrated;
}

const legacyPresentation = (value = {}) => {
  const preset = value.displayPreset || "reading";
  return {
    width: preset === "thinker-card" ? "reading" : preset === "compact" ? "compact" : preset,
    align: value.align || "center",
    density: "standard",
  };
};

/** Deterministically migrate schema-v3 ordered flow to the layout-capable schema v4. */
export function migrateChapterV3ToV4(chapter) {
  if (chapter?.schemaVersion === 4) return structuredClone(chapter);
  if (chapter?.schemaVersion !== 3) throw new ChapterFlowError("CONTENT_SCHEMA_VERSION_UNSUPPORTED", "Only schema-v3 chapters can be migrated to schema v4.", "schemaVersion");
  projectV3OrderedChapter(chapter);
  const migrated = structuredClone(chapter);
  migrated.schemaVersion = 4;
  migrated.layoutCatalogVersion = "2026-08-06";
  migrated.layoutRegions = [];
  migrated.body = migrated.body.map((block) => {
    if (!["mediaFigure", "externalEmbed", "richLink", "diagram"].includes(block.type)) return block;
    const presentation = legacyPresentation(block);
    const { displayPreset: _displayPreset, align: _align, ...rest } = block;
    return { ...rest, presentation };
  });
  migrated.personFeatures = (migrated.personFeatures || []).map(({ displayPreset: _displayPreset, ...feature }) => feature);
  migrated.managedPlacements = (migrated.managedPlacements || []).map(({ displayPreset: _displayPreset, ...placement }) => ({ ...placement, presentation: legacyPresentation({ displayPreset: _displayPreset }) }));
  projectV3OrderedChapter(migrated);
  return migrated;
}

/** Convenience adapter for old Git fixtures that need the current schema. */
export function migrateChapterToV4(chapter, options = {}) {
  if (chapter?.schemaVersion === 4) return structuredClone(chapter);
  return migrateChapterV3ToV4(chapter?.schemaVersion === 2 ? migrateChapterV2ToV3(chapter, options) : chapter);
}

/** Temporary compatibility export for consumers that still require v2 anchors. */
export function exportChapterV3AsV2(chapter) {
  if (chapter?.schemaVersion === 2) return structuredClone(chapter);
  if (chapter?.schemaVersion !== 3) throw new ChapterFlowError("CONTENT_SCHEMA_VERSION_UNSUPPORTED", "Only schema-v3 chapters can be exported through the legacy adapter.", "schemaVersion");
  projectV3OrderedChapter(chapter);
  const legacy = structuredClone(chapter);
  const checkpoints = new Map((legacy.checkpoints || []).map((value) => [value.checkpointId, value]));
  const placements = new Map((legacy.managedPlacements || []).map((value) => [value.placementId, value]));
  const anchorOrders = new Map();
  const body = [];
  legacy.body.forEach((node, index) => {
    if (node.type === "checkpointRef") {
      const checkpoint = checkpoints.get(node.checkpointId);
      const passage = checkpoint.passageId || nearestFlowPassage(legacy.body, index);
      const key = `${passage}:after`;
      const order = anchorOrders.get(key) || 0;
      checkpoint.displayOrder = order;
      anchorOrders.set(key, order + 1);
      return;
    }
    if (node.type === "placementRef") {
      const placement = placements.get(node.placementId);
      const contextual = placement.anchorPassageId;
      const previous = nearestFlowPassage(legacy.body.slice(0, index + 1), index);
      let next = null;
      for (let cursor = index + 1; cursor < legacy.body.length; cursor += 1) {
        if (!["checkpointRef", "placementRef"].includes(legacy.body[cursor]?.type)) { next = flowPassageId(legacy.body[cursor]); if (next) break; }
      }
      const position = contextual && contextual === next && contextual !== previous ? "before" : "after";
      const anchorPassageId = contextual || previous || next;
      const key = `${anchorPassageId}:${position}`;
      const orderAtAnchor = anchorOrders.get(key) || 0;
      Object.assign(placement, { anchorPassageId, position, orderAtAnchor });
      anchorOrders.set(key, orderAtAnchor + 1);
      return;
    }
    body.push(node);
  });
  legacy.schemaVersion = 2;
  legacy.body = body;
  return legacy;
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

const presentationOf = (value = {}) => value.presentation || legacyPresentation(value);
const cardAttributes = (value = {}) => {
  const presentation = presentationOf(value);
  return ` data-card-width="${escapeHtml(presentation.width)}" data-card-align="${escapeHtml(presentation.align)}" data-card-density="${escapeHtml(presentation.density)}"`;
};
const frameStyle = (frame = {}) => {
  const aspects = { "1:1": "1/1", "4:3": "4/3", "3:2": "3/2", "16:9": "16/9", "2:3": "2/3" };
  const declarations = [];
  if (aspects[frame.aspect]) declarations.push(`--card-aspect:${aspects[frame.aspect]}`);
  if (frame.focalPoint) declarations.push(`--card-focus:${Math.round(frame.focalPoint.x * 100)}% ${Math.round(frame.focalPoint.y * 100)}%`);
  return declarations.length ? ` style="${declarations.join(";")}"` : "";
};
const framedImage = (src, alt, decorative, presentation) => {
  if (!src) return null;
  const frame = presentation?.frame || { mode: "intrinsic", aspect: "auto" };
  return `<div class="chapter-card__frame" data-frame-mode="${escapeHtml(frame.mode)}" data-frame-aspect="${escapeHtml(frame.aspect || "auto")}"${frameStyle(frame)}><img src="${escapeHtml(src)}" alt="${escapeHtml(decorative ? "" : alt || "")}"${decorative ? " aria-hidden=\"true\"" : ""}></div>`;
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
  if (block.type === "diagram") return `<figure class="chapter-managed chapter-card chapter-diagram"${cardAttributes(block)}${blockId}><div data-diagram-id="${escapeHtml(block.diagramId || "")}">${escapeHtml(block.description || block.title || "Interactive diagram")}</div></figure>`;
  if (block.type === "artifactCard") return `<aside class="chapter-managed chapter-card chapter-artifact"${cardAttributes(block)}${blockId}><strong>${escapeHtml(block.title)}</strong><p>${inline(block.summary)}</p><p>${inline(block.teachingUse)}</p></aside>`;
  if (block.type === "sourceCard") return `<aside class="chapter-managed chapter-card chapter-source"${cardAttributes(block)}${blockId}><strong>${escapeHtml(block.title)}</strong>${block.creator ? `<p>${escapeHtml(block.creator)}</p>` : ""}${block.excerpt ? `<blockquote>${inline(block.excerpt)}</blockquote>` : ""}<p>${inline(block.teachingUse)}</p></aside>`;
  if (block.type === "personFeature") return renderPerson(block, options);
  return "";
};

const renderMedia = (block, options) => {
  const src = publicAssetUrl(block.src || block.derivativeUrl || block.posterUrl, options.publicOrigin);
  const caption = block.caption ? `<figcaption>${inline(block.caption)}</figcaption>` : "";
  const credit = block.creditOverride || block.credit;
  const presentation = presentationOf(block);
  return `<figure class="chapter-managed chapter-card chapter-media"${cardAttributes(block)} data-content-block-id="${escapeHtml(block.blockId || "")}" data-media-version-id="${escapeHtml(block.mediaVersionId || "")}">${framedImage(src, block.alt, block.decorative, presentation) || `<div class="chapter-media__fallback" role="img" aria-label="${escapeHtml(block.alt || "Media preview")}">${escapeHtml(block.caption || "Media")}</div>`}${caption}${credit ? `<p class="chapter-media__credit">${inline(credit)}</p>` : ""}</figure>`;
};

const renderEmbed = (block) => {
  const url = safeHref(block.canonicalUrl);
  const title = block.title || block.fallback?.title || block.caption || "External resource";
  const summary = block.summary || block.fallback?.summary || block.teachingUse || "";
  const label = block.linkLabel || block.fallback?.linkLabel || "Open canonical source";
  const provider = block.identity?.provider || (block.type === "richLink" ? "link" : "external");
  return `<aside class="chapter-managed chapter-card chapter-embed"${cardAttributes(block)} data-content-block-id="${escapeHtml(block.blockId || "")}" data-embed-provider="${escapeHtml(provider)}"><strong>${escapeHtml(title)}</strong>${summary ? `<p>${inline(summary)}</p>` : ""}${url ? `<p><a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(label)}</a></p><button type="button" class="chapter-embed__activation" data-activate-embed="${escapeHtml(provider)}" data-provider-url="${escapeHtml(url)}">Activate ${escapeHtml(provider)} embed</button>` : ""}</aside>`;
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
  return `<aside class="chapter-managed chapter-card chapter-person"${cardAttributes(person)} data-person-feature-id="${escapeHtml(person.personFeatureId || person.placementId || "")}" data-person-id="${escapeHtml(person.personId || person.entityId || "")}"><div class="chapter-person__content"><div class="chapter-person__portrait">${framedImage(portrait, portraitAlt, false, presentationOf(person)) || ""}${credit ? `<p class="chapter-person__credit">${inline(credit)}</p>` : ""}</div><div class="chapter-person__body"><p class="chapter-person__label">${escapeHtml(person.label || "Thinker in the text")}</p><h3>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(name)}</a>` : escapeHtml(name)}</h3>${person.dates ? `<p>${escapeHtml(person.dates)}</p>` : ""}${person.role ? `<p><em>${escapeHtml(person.role)}</em></p>` : ""}${biography ? `<p>${inline(biography)}</p>` : ""}${primary ? `<p><strong>Primary text:</strong> ${escapeHtml(primary)}</p>` : ""}</div></div></aside>`;
};

export function renderOrderedNode(node, options = {}) {
  if (node.kind === "block") return renderBlock(node.value, options);
  if (node.kind === "checkpoint") return renderCheckpoint(node.value);
  if (node.kind === "personFeature") return renderPerson(node.value, options);
  return "";
}

const orderedNodeId = (node) => node?.kind === "checkpoint"
  ? node.value?.checkpointId
  : node?.value?.blockId || node?.value?.placementId || node?.value?.personFeatureId || null;

const renderLayoutRegion = (region, nodes, options) => {
  const attributes = ` data-layout-id="${escapeHtml(region.layoutId)}" data-layout-type="${escapeHtml(region.type)}"`;
  if (region.type === "wrap") {
    const width = { compact: "16rem", narrow: "22rem", medium: "30rem" }[region.width] || "22rem";
    return `<section class="chapter-layout chapter-layout--wrap"${attributes} data-card-side="${escapeHtml(region.side)}" style="--card-region-width:${width}">${nodes.map((node) => renderOrderedNode(node, options)).join("\n")}</section>`;
  }
  if (region.type === "card-grid") {
    const cards = new Set(region.cardNodeIds || []);
    return `<section class="chapter-layout chapter-layout--card-grid"${attributes} data-emphasis="${escapeHtml(region.emphasis)}" data-ratio="${escapeHtml(region.ratio || "equal")}" style="--grid-columns:${Number(region.columns) || 2}">${nodes.map((node) => {
      const nodeId = orderedNodeId(node); const html = renderOrderedNode(node, options);
      return region.featuredNodeId === nodeId ? html.replace(" class=\"chapter-managed chapter-card", " data-featured=\"true\" class=\"chapter-managed chapter-card") : cards.has(nodeId) ? html : html;
    }).join("\n")}</section>`;
  }
  const cardIds = new Set(region.cardNodeIds || []);
  const cards = nodes.filter((node) => cardIds.has(orderedNodeId(node))).map((node) => renderOrderedNode(node, options)).join("\n");
  const textNodes = nodes.filter((node) => !cardIds.has(orderedNodeId(node))).map((node) => renderOrderedNode(node, options)).join("\n");
  const cardFirst = cardIds.has(orderedNodeId(nodes[0]));
  const columns = region.ratio === "card-narrow" ? (region.cardSide === "start" ? "minmax(14rem,.7fr) 1.3fr" : "1.3fr minmax(14rem,.7fr)") : region.ratio === "card-wide" ? (region.cardSide === "start" ? "1.3fr minmax(16rem,.7fr)" : "minmax(16rem,.7fr) 1.3fr") : "1fr 1fr";
  const cardGroup = `<div class="chapter-layout__cards">${cards}</div>`;
  const textGroup = `<div class="chapter-layout__text">${textNodes}</div>`;
  return `<section class="chapter-layout chapter-layout--card-text-split"${attributes} data-card-side="${escapeHtml(region.cardSide)}" style="--split-columns:${columns}">${cardFirst ? cardGroup + textGroup : textGroup + cardGroup}</section>`;
};

const renderOrderedLayout = (chapter, orderedNodes, options) => {
  const regions = Array.isArray(chapter.layoutRegions) ? chapter.layoutRegions : [];
  if (!regions.length) return orderedNodes.map((node) => renderOrderedNode(node, options)).join("\n");
  const indexById = new Map(orderedNodes.map((node, index) => [orderedNodeId(node), index]).filter(([key]) => key));
  const byStart = new Map();
  for (const region of regions) {
    const start = indexById.get(region.startNodeId); const end = indexById.get(region.endNodeId);
    if (start === undefined || end === undefined || start > end) continue;
    byStart.set(start, { region, end });
  }
  const rendered = [];
  for (let index = 0; index < orderedNodes.length; index += 1) {
    const match = byStart.get(index);
    if (!match) { rendered.push(renderOrderedNode(orderedNodes[index], options)); continue; }
    rendered.push(renderLayoutRegion(match.region, orderedNodes.slice(index, match.end + 1), options));
    index = match.end;
  }
  return rendered.join("\n");
};

export function renderChapterProjection(chapter, options = {}) {
  const orderedNodes = projectOrderedChapter(chapter, options);
  return {
    schemaVersion: 1,
    revisionId: chapter?.revisionId || null,
    chapterVersion: chapter?.chapterVersion || null,
    title: chapter?.title || "Untitled chapter",
    stylesheetVersion: CHAPTER_RENDERER_STYLE_VERSION,
    html: `<div class="chapter-flow"${chapter?.layoutCatalogVersion ? ` data-layout-catalog-version="${escapeHtml(chapter.layoutCatalogVersion)}"` : ""}>${renderOrderedLayout(chapter, orderedNodes, options)}</div>`,
    prompts: orderedNodes.filter((node) => node.kind === "checkpoint" && node.value.showInSidebar !== false).map((node) => ({ ...node.value })),
    orderedNodes,
    projectionProvenance: chapter?.schemaVersion === 4 ? "v4-layout-flow" : chapter?.schemaVersion === 3 ? "v3-flow" : "v2-anchor-adapter",
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
