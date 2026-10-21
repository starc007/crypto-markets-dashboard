import type { AccentColor } from "@/lib/color";
import type { CategoryId } from "./categories";
import type { FxSnapshot } from "./currency";

/**
 * Wire contract between our API routes and the browser. Every numeric field is
 * nullable: "unknown" must never be coerced to 0, because 0 is a real value.
 */

/** Normalised market data for one asset, independent of our metadata. */
export interface MarketQuote {
  id: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  rank: number | null;
  priceUsd: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  high24hUsd: number | null;
  low24hUsd: number | null;
  circulatingSupply: number | null;
  /** When CoinGecko last updated this asset's price (ISO 8601). */
  lastUpdated: string | null;
}

/** A quote joined with application-owned metadata. */
export interface MarketCoin extends MarketQuote {
  category: CategoryId;
  accent: AccentColor;
  /** False when the asset is not in our curated metadata and fallbacks were applied. */
  hasCuratedMetadata: boolean;
  /**
   * A light 7-day USD price series for row sparklines (every ~4 hours). The
   * full hourly series is only sent with asset details.
   */
  trend7d: number[] | null;
}

export type UpstreamErrorCode =
  "RATE_LIMITED" | "UNAUTHORIZED" | "UNAVAILABLE" | "TIMEOUT" | "INVALID_RESPONSE";

export interface RefreshFailure {
  code: UpstreamErrorCode;
  /** When the failed refresh happened (ISO 8601). */
  at: string;
  /** Earliest time the server will try again (ISO 8601). */
  retryAt: string;
}

export interface SnapshotMeta {
  /** When the server received this data from CoinGecko (ISO 8601). */
  fetchedAt: string;
  /** When the server produced this response (ISO 8601). Used to compute age without trusting client clocks. */
  generatedAt: string;
  /** How long the server treats a snapshot as fresh before refreshing it. */
  refreshIntervalMs: number;
  /** Set when the most recent refresh attempt failed and older data is being served. */
  lastRefreshFailure: RefreshFailure | null;
}

export interface MarketsResponse {
  /** All values in USD; clients convert with `fx`. */
  coins: MarketCoin[];
  /** USD exchange rates for the other supported currencies, or null if unavailable. */
  fx: FxSnapshot | null;
  meta: SnapshotMeta;
}

/**
 * Hourly history for one asset in a given snapshot. Prices and stats are not
 * repeated here: every view reads those from `MarketsResponse`, so the same
 * asset can never show two different prices on screen.
 */
export interface CoinHistoryResponse {
  id: string;
  /** The snapshot this history belongs to; matches `MarketsResponse.meta.fetchedAt`. */
  fetchedAt: string;
  /** Roughly hourly USD prices for the last 7 days, oldest first. */
  prices: number[] | null;
}

export type ApiErrorCode = UpstreamErrorCode | "NOT_FOUND" | "BAD_REQUEST" | "INTERNAL";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    retryAfterSeconds?: number;
  };
}
