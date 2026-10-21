import type { AccentColor } from "@/lib/color";
import type { CategoryId } from "./categories";

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
  coins: MarketCoin[];
  meta: SnapshotMeta;
}

export interface CoinDetailResponse {
  coin: MarketCoin;
  /** Roughly hourly USD prices for the last 7 days, oldest first. */
  sparkline7d: number[] | null;
  meta: SnapshotMeta;
}

export type ApiErrorCode = UpstreamErrorCode | "NOT_FOUND" | "BAD_REQUEST" | "INTERNAL";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    retryAfterSeconds?: number;
  };
}
