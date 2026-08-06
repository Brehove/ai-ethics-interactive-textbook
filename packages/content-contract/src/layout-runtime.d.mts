export const LAYOUT_CATALOG_VERSION: "2026-08-06";
export const LAYOUT_CATALOG: Readonly<{
  version: typeof LAYOUT_CATALOG_VERSION;
  widths: Record<string, { maxRem: number | null; use: string }>;
  regions: Record<string, { cardCount: number[]; textRequired: boolean; guidance: string; ratios?: string[] }>;
  responsive: { collapseBelowPx: number; sourceOrderPreserved: boolean };
  print: { regionLayoutsFlatten: boolean; sourceOrderPreserved: boolean };
}>;
export function cardNodeId(value: Record<string, unknown>): string | null;
export function validateLayoutRegions(body: Array<Record<string, unknown>>, regions: Array<Record<string, unknown>>): Array<{ code: string; path: string; message: string }>;
