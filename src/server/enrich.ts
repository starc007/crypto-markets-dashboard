import "server-only";
import { deriveAccent } from "@/lib/color";
import { downsample } from "@/lib/series";
import { getAssetMetadata } from "@/shared/asset-metadata";
import { FALLBACK_CATEGORY } from "@/shared/categories";
import type { MarketCoin, MarketQuote } from "@/shared/market";

/** Neutral grey for assets without a curated colour; never a guessed brand colour. */
export const FALLBACK_COLOR = "#8B93A1";

/**
 * Row sparklines only need a shape: 42 points (one every 4 hours) at 5
 * significant digits, about a tenth of the full hourly series' payload.
 */
const TREND_POINTS = 42;
const TREND_PRECISION = 5;

const accentCache = new Map<string, string>();
const reportedUnknownIds = new Set<string>();

function accentFor(color: string): string {
  let accent = accentCache.get(color);
  if (!accent) {
    accent = deriveAccent(color);
    accentCache.set(color, accent);
  }
  return accent;
}

/**
 * Joins market data with application-owned metadata. This runs on every read
 * rather than when the snapshot is cached, so metadata and market data stay
 * independent: changing a colour never requires refetching prices.
 */
export function enrichQuote(quote: MarketQuote, sparkline: readonly number[] | null): MarketCoin {
  const metadata = getAssetMetadata(quote.id);
  if (!metadata && !reportedUnknownIds.has(quote.id)) {
    reportedUnknownIds.add(quote.id);
    console.warn(`[metadata] No curated metadata for "${quote.id}"; using fallbacks.`);
  }
  return {
    ...quote,
    category: metadata?.category ?? FALLBACK_CATEGORY,
    accent: accentFor(metadata?.color ?? FALLBACK_COLOR),
    trend7d: sparkline
      ? downsample(sparkline, TREND_POINTS).map((p) => Number(p.toPrecision(TREND_PRECISION)))
      : null,
  };
}
