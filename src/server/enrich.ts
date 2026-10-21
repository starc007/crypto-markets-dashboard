import "server-only";
import { deriveAccent, type AccentColor } from "@/lib/color";
import { getAssetMetadata } from "@/shared/asset-metadata";
import { FALLBACK_CATEGORY } from "@/shared/categories";
import type { MarketCoin, MarketQuote } from "@/shared/market";

/** Neutral grey for assets without a curated colour; never a guessed brand colour. */
export const FALLBACK_COLOR = "#8B93A1";

const accentCache = new Map<string, AccentColor>();
const reportedUnknownIds = new Set<string>();

function accentFor(color: string): AccentColor {
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
export function enrichQuote(quote: MarketQuote): MarketCoin {
  const metadata = getAssetMetadata(quote.id);
  if (!metadata && !reportedUnknownIds.has(quote.id)) {
    reportedUnknownIds.add(quote.id);
    console.warn(`[metadata] No curated metadata for "${quote.id}"; using fallbacks.`);
  }
  return {
    ...quote,
    category: metadata?.category ?? FALLBACK_CATEGORY,
    accent: accentFor(metadata?.color ?? FALLBACK_COLOR),
    hasCuratedMetadata: metadata !== undefined,
  };
}
