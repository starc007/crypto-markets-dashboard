import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { CATEGORY_IDS, type CategoryId } from "@/shared/categories";
import { SURFACE, contrastRatio, toHex } from "./color";
import type { DisplayCoin } from "./currency-conversion";
import { formatPercentChange } from "./format";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeatmapLayout {
  categories: (Rect & { id: CategoryId })[];
  tiles: (Rect & { coin: DisplayCoin })[];
  /** Assets left out because their market cap is unknown, so they have no size. */
  excluded: DisplayCoin[];
}

/** Room above each category's tiles for its label. */
export const CATEGORY_LABEL_HEIGHT = 24;
const CATEGORY_GAP = 4;
const TILE_GAP = 2;

type Node = { id?: CategoryId; coin?: DisplayCoin; children?: Node[] };

/**
 * Nested squarified treemap: categories, then assets, with area proportional
 * to market cap. Squarified tiles stay close to square, which keeps labels
 * readable and areas easy to compare by eye.
 */
export function layoutHeatmap(
  groups: Record<CategoryId, readonly DisplayCoin[]>,
  width: number,
  height: number,
): HeatmapLayout {
  const excluded: DisplayCoin[] = [];
  const children: Node[] = [];
  for (const id of CATEGORY_IDS) {
    const sized = groups[id].filter((coin) => {
      const ok = coin.marketCap !== null && coin.marketCap > 0;
      if (!ok) excluded.push(coin);
      return ok;
    });
    if (sized.length > 0) children.push({ id, children: sized.map((coin) => ({ coin })) });
  }

  if (children.length === 0 || width <= 0 || height <= 0) {
    return { categories: [], tiles: [], excluded };
  }

  const root = hierarchy<Node>({ children })
    .sum((node) => node.coin?.marketCap ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const laidOut = treemap<Node>()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingOuter(0)
    .paddingInner((node) => (node.depth === 0 ? CATEGORY_GAP : TILE_GAP))
    .paddingTop((node) => (node.depth === 1 ? CATEGORY_LABEL_HEIGHT : 0))
    .round(true)(root);

  const toRect = (n: { x0: number; y0: number; x1: number; y1: number }): Rect => ({
    x: n.x0,
    y: n.y0,
    width: Math.max(0, n.x1 - n.x0),
    height: Math.max(0, n.y1 - n.y0),
  });

  return {
    categories: (laidOut.children ?? []).map((node) => ({ id: node.data.id!, ...toRect(node) })),
    tiles: laidOut.leaves().map((leaf) => ({ coin: leaf.data.coin!, ...toRect(leaf) })),
    excluded,
  };
}

/** Changes at or beyond this magnitude get the strongest colour. */
export const HEAT_SATURATION_PCT = 8;

const NEUTRAL: [number, number, number] = [233, 236, 241];
/** `--text` and a slightly softer grey from globals.css; tiles pick whichever reads at 4.5:1. */
const TEXT_DARK = "#101828";
const TEXT_ON_NEUTRAL = "#344054";
const UP: [number, number, number] = [3, 152, 85];
const DOWN: [number, number, number] = [217, 45, 32];

export interface HeatColor {
  background: string;
  text: string;
}

/**
 * Tile colour for a 24h change. Like every other change on the page, the
 * direction comes from the rounded value, so a change shown as 0.00% is
 * neutral. Intensity eases in, so small moves stay readable but calm.
 */
export function heatColor(changePct: number | null): HeatColor {
  const { direction } = formatPercentChange(changePct);
  if (direction === null || direction === "flat" || changePct === null) {
    return { background: toHex(NEUTRAL), text: TEXT_ON_NEUTRAL };
  }
  const target = direction === "up" ? UP : DOWN;
  const t = 0.18 + 0.82 * Math.min(1, Math.abs(changePct) / HEAT_SATURATION_PCT) ** 0.7;
  const background = toHex(NEUTRAL.map((c, i) => c + (target[i]! - c) * t));
  const text = contrastRatio(background, SURFACE) >= 4.5 ? SURFACE : TEXT_DARK;
  return { background, text };
}
