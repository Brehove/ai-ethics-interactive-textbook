import { z } from "zod";
import { LAYOUT_CATALOG_VERSION } from "./layout-runtime.mjs";
export { LAYOUT_CATALOG, LAYOUT_CATALOG_VERSION, cardNodeId, validateLayoutRegions } from "./layout-runtime.mjs";

export const CardWidthSchema = z.enum(["compact", "narrow", "medium", "reading", "wide", "full", "bleed"]);
export const CardAlignSchema = z.enum(["start", "center", "end"]);
export const CardDensitySchema = z.enum(["compact", "standard", "expanded"]);
export const CardFrameModeSchema = z.enum(["intrinsic", "contain", "crop"]);
export const CardFrameAspectSchema = z.enum(["auto", "1:1", "4:3", "3:2", "16:9", "2:3"]);

export const CardFrameSchema = z.object({
  mode: CardFrameModeSchema,
  aspect: CardFrameAspectSchema.default("auto"),
  focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict().optional(),
  approvalId: z.string().regex(/^approval_[A-Za-z0-9][A-Za-z0-9_-]*$/).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.focalPoint && value.mode !== "crop") ctx.addIssue({ code: "custom", path: ["focalPoint"], message: "Focal points are valid only for crop frames" });
  if (value.mode === "crop" && value.aspect === "auto") ctx.addIssue({ code: "custom", path: ["aspect"], message: "Crop frames require an explicit aspect ratio" });
});

export const CardPresentationSchema = z.object({
  width: CardWidthSchema,
  align: CardAlignSchema,
  density: CardDensitySchema,
  frame: CardFrameSchema.optional(),
}).strict();

const id = (kind: string) => z.string().regex(new RegExp(`^${kind}_[A-Za-z0-9][A-Za-z0-9_-]*$`));
const regionBase = { layoutId: id("layout"), startNodeId: z.string().min(1), endNodeId: z.string().min(1) };

export const WrapLayoutRegionSchema = z.object({
  ...regionBase,
  type: z.literal("wrap"),
  cardNodeId: z.string().min(1),
  side: z.enum(["start", "end"]),
  width: z.enum(["compact", "narrow", "medium"]),
}).strict();

export const CardTextSplitLayoutRegionSchema = z.object({
  ...regionBase,
  type: z.literal("card-text-split"),
  cardNodeIds: z.array(z.string().min(1)).min(1).max(3),
  textNodeIds: z.array(z.string().min(1)).min(1).max(20),
  cardSide: z.enum(["start", "end"]),
  ratio: z.enum(["card-narrow", "balanced", "card-wide"]),
}).strict();

export const CardGridLayoutRegionSchema = z.object({
  ...regionBase,
  type: z.literal("card-grid"),
  cardNodeIds: z.array(z.string().min(1)).min(2).max(6),
  columns: z.number().int().min(2).max(4),
  emphasis: z.enum(["equal", "featured"]),
  ratio: z.enum(["equal", "start-narrow", "end-narrow"]).default("equal"),
  featuredNodeId: z.string().min(1).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.columns > value.cardNodeIds.length) ctx.addIssue({ code: "custom", path: ["columns"], message: "Columns cannot exceed the number of cards" });
  if (value.emphasis === "featured" && (!value.featuredNodeId || !value.cardNodeIds.includes(value.featuredNodeId))) ctx.addIssue({ code: "custom", path: ["featuredNodeId"], message: "Featured grids require one featured card from the region" });
  if (value.emphasis === "equal" && value.featuredNodeId) ctx.addIssue({ code: "custom", path: ["featuredNodeId"], message: "Equal grids cannot select a featured card" });
  if (value.ratio !== "equal" && (value.cardNodeIds.length !== 2 || value.columns !== 2 || value.emphasis !== "equal")) ctx.addIssue({ code: "custom", path: ["ratio"], message: "Unequal ratios require exactly two cards, two columns, and equal emphasis" });
});

export const LayoutRegionSchema = z.union([WrapLayoutRegionSchema, CardTextSplitLayoutRegionSchema, CardGridLayoutRegionSchema]);
export const NewLayoutRegionSchema = z.union([
  WrapLayoutRegionSchema.omit({ layoutId: true }),
  CardTextSplitLayoutRegionSchema.omit({ layoutId: true }),
  z.object({
    type: z.literal("card-grid"), startNodeId: z.string().min(1), endNodeId: z.string().min(1),
    cardNodeIds: z.array(z.string().min(1)).min(2).max(6), columns: z.number().int().min(2).max(4),
    emphasis: z.enum(["equal", "featured"]), ratio: z.enum(["equal", "start-narrow", "end-narrow"]).default("equal"), featuredNodeId: z.string().min(1).optional(),
  }).strict().superRefine((value, ctx) => {
    if (value.columns > value.cardNodeIds.length) ctx.addIssue({ code: "custom", path: ["columns"], message: "Columns cannot exceed the number of cards" });
    if (value.emphasis === "featured" && (!value.featuredNodeId || !value.cardNodeIds.includes(value.featuredNodeId))) ctx.addIssue({ code: "custom", path: ["featuredNodeId"], message: "Featured grids require one featured card from the region" });
    if (value.emphasis === "equal" && value.featuredNodeId) ctx.addIssue({ code: "custom", path: ["featuredNodeId"], message: "Equal grids cannot select a featured card" });
    if (value.ratio !== "equal" && (value.cardNodeIds.length !== 2 || value.columns !== 2 || value.emphasis !== "equal")) ctx.addIssue({ code: "custom", path: ["ratio"], message: "Unequal ratios require exactly two cards, two columns, and equal emphasis" });
  }),
]);
export type CardPresentation = z.infer<typeof CardPresentationSchema>;
export type LayoutRegion = z.infer<typeof LayoutRegionSchema>;
