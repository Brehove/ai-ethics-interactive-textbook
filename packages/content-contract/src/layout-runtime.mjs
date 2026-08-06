export const LAYOUT_CATALOG_VERSION = "2026-08-06.1";

export const LAYOUT_CATALOG = Object.freeze({
  version: LAYOUT_CATALOG_VERSION,
  widths: {
    compact: { maxRem: 16, use: "small supporting card" }, narrow: { maxRem: 22, use: "portrait or brief contextual card" }, medium: { maxRem: 30, use: "substantial supporting card" }, reading: { maxRem: 44, use: "default reading-column card" }, wide: { maxRem: 60, use: "detailed card or landscape media" }, full: { maxRem: 76, use: "full reader canvas" }, bleed: { maxRem: null, use: "edge-to-edge visual; use sparingly" }
  },
  surfaces: {
    plain: { use: "unadorned media whose caption and credit remain secondary" },
    panel: { use: "bounded contextual media whose image, caption, and credit should read as one artifact" }
  },
  regions: {
    wrap: { cardCount: [1, 1], textRequired: true, guidance: "Use for a compact or narrow card beside prose of at least two paragraphs." },
    "card-text-split": { cardCount: [1, 3], textRequired: true, guidance: "Use when card and text form one deliberate comparison or explanation." },
    "card-grid": {
      cardCount: [2, 6], textRequired: false,
      ratios: ["equal", "start-narrow", "end-narrow"],
      guidance: "Use equal for peer cards. For exactly two related cards, use start-narrow or end-narrow when one is a brief supporting artifact and the other needs the larger reading field; ratio names follow source order."
    }
  },
  responsive: { collapseBelowPx: 720, sourceOrderPreserved: true }, print: { regionLayoutsFlatten: true, sourceOrderPreserved: true }
});

export const cardNodeId = (value) => {
  for (const key of ["blockId", "placementId"]) if (typeof value?.[key] === "string") return value[key];
  return null;
};

export function validateLayoutRegions(body, regions) {
  const errors = []; const nodeIds = body.map(cardNodeId);
  const indexById = new Map(nodeIds.flatMap((value, index) => value ? [[value, index]] : [])); const owned = new Map();
  const byId = new Map(body.flatMap((node) => cardNodeId(node) ? [[cardNodeId(node), node]] : []));
  const isCard = (node) => node?.type === "placementRef" || ["mediaFigure", "externalEmbed", "richLink", "diagram", "artifactCard", "sourceCard"].includes(node?.type);
  const isText = (node) => ["paragraph", "list", "blockquote", "callout"].includes(node?.type);
  for (const [regionIndex, region] of regions.entries()) {
    const start = indexById.get(region.startNodeId); const end = indexById.get(region.endNodeId);
    if (start === undefined || end === undefined || start > end) { errors.push({ code: "LAYOUT_REGION_RANGE_INVALID", path: `layoutRegions.${regionIndex}`, message: "Region bounds must identify an ordered contiguous flow span" }); continue; }
    const span = new Set(nodeIds.slice(start, end + 1).filter(Boolean));
    const members = region.type === "wrap" ? [region.cardNodeId] : region.type === "card-grid" ? region.cardNodeIds : [...region.cardNodeIds, ...region.textNodeIds];
    for (const member of members) if (!span.has(member)) errors.push({ code: "LAYOUT_REGION_MEMBER_OUTSIDE_RANGE", path: `layoutRegions.${regionIndex}`, message: `Node ${member} is outside the region range` });
    const cardMembers = region.type === "wrap" ? [region.cardNodeId] : region.cardNodeIds;
    for (const member of cardMembers) if (!isCard(byId.get(member))) errors.push({ code: "LAYOUT_REGION_CARD_REQUIRED", path: `layoutRegions.${regionIndex}`, message: `Node ${member} is not a layout-capable card` });
    if (region.type === "card-grid" && [...span].some((member) => !isCard(byId.get(member)))) errors.push({ code: "LAYOUT_REGION_GRID_CARD_ONLY", path: `layoutRegions.${regionIndex}`, message: "Card grids cannot contain prose or checkpoints" });
    if (region.type === "wrap" && [...span].filter((member) => isText(byId.get(member))).length < 2) errors.push({ code: "LAYOUT_REGION_WRAP_TEXT_REQUIRED", path: `layoutRegions.${regionIndex}`, message: "Wrap regions require at least two prose blocks" });
    if (region.type === "card-text-split") {
      for (const member of region.textNodeIds) if (!isText(byId.get(member))) errors.push({ code: "LAYOUT_REGION_TEXT_REQUIRED", path: `layoutRegions.${regionIndex}`, message: `Node ${member} is not supported split prose` });
      const declared = new Set([...region.cardNodeIds, ...region.textNodeIds]);
      if ([...span].some((member) => !declared.has(member))) errors.push({ code: "LAYOUT_REGION_SPLIT_MEMBER_REQUIRED", path: `layoutRegions.${regionIndex}`, message: "Card-text splits cannot contain undeclared flow nodes" });
      const groups = nodeIds.slice(start, end + 1).map((member) => region.cardNodeIds.includes(member) ? "card" : region.textNodeIds.includes(member) ? "text" : "other").filter((kind, index, kinds) => index === 0 || kind !== kinds[index - 1]);
      if (groups.length > 2 || groups.includes("other")) errors.push({ code: "LAYOUT_REGION_SPLIT_ORDER_INVALID", path: `layoutRegions.${regionIndex}`, message: "Split cards and prose must form two contiguous source-order groups" });
    }
    for (const nodeId of span) { if (owned.has(nodeId)) errors.push({ code: "LAYOUT_REGION_OVERLAP", path: `layoutRegions.${regionIndex}`, message: `Node ${nodeId} already belongs to ${owned.get(nodeId)}` }); else owned.set(nodeId, region.layoutId); }
  }
  return errors;
}
