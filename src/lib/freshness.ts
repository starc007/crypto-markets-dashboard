import { LIVE_GRACE_MS, STALE_AFTER_INTERVALS } from "@/shared/freshness-policy";
import type { SnapshotMeta } from "@/shared/market";

export type Freshness = "live" | "delayed" | "stale";

/** An asset's own price is "lagging" when CoinGecko hasn't updated it for this long. */
export const QUOTE_LAG_THRESHOLD_MS = 60 * 60_000;

/**
 * Age of the data right now, in ms.
 *
 * The server reports both `fetchedAt` and `generatedAt` from its own clock, so
 * their difference is the age at the moment of the response regardless of
 * client clock skew. We then add the time elapsed locally since we received it.
 */
export function dataAgeMs(meta: SnapshotMeta, receivedAt: number, now: number): number {
  const ageAtResponse = Date.parse(meta.generatedAt) - Date.parse(meta.fetchedAt);
  return Math.max(0, ageAtResponse) + Math.max(0, now - receivedAt);
}

export function classifyFreshness(ageMs: number, refreshIntervalMs: number): Freshness {
  if (ageMs <= refreshIntervalMs + LIVE_GRACE_MS) return "live";
  if (ageMs <= refreshIntervalMs * STALE_AFTER_INTERVALS) return "delayed";
  return "stale";
}

/** How far behind our snapshot an asset's own last price update is, if beyond the threshold. */
export function quoteLagMs(lastUpdated: string | null, fetchedAt: string): number | null {
  if (!lastUpdated) return null;
  const lag = Date.parse(fetchedAt) - Date.parse(lastUpdated);
  return Number.isFinite(lag) && lag > QUOTE_LAG_THRESHOLD_MS ? lag : null;
}
