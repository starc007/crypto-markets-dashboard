"use client";

import { useNow } from "@/hooks/use-now";
import { ApiError } from "@/lib/api-client";
import { classifyFreshness, dataAgeMs, type Freshness } from "@/lib/freshness";
import type { SnapshotMeta, UpstreamErrorCode } from "@/shared/market";

export interface FreshnessState {
  freshness: Freshness;
  /** Null until mounted: relative times are client-only to avoid hydration mismatches. */
  ageMs: number | null;
  /** Why data may be old, if we know. */
  reason: string | null;
  /** How often the server refreshes, so "updated 4 min ago" reads as expected rather than broken. */
  refreshIntervalMs: number;
  /** Identifies the snapshot, so the indicator can mark the arrival of a new one. */
  fetchedAt: string;
}

const PROVIDER_REASONS: Record<UpstreamErrorCode, string> = {
  RATE_LIMITED: "Our data provider is limiting requests. We'll keep retrying automatically.",
  UNAUTHORIZED: "Our data provider rejected our credentials.",
  UNAVAILABLE: "Our data provider isn't responding. We'll keep retrying automatically.",
  TIMEOUT: "Our data provider isn't responding. We'll keep retrying automatically.",
  INVALID_RESPONSE:
    "Our data provider sent data we couldn't verify, so we kept the last good prices.",
};

/** How this client's own connection to our server is doing. */
export interface ConnectionState {
  error: Error | null;
  /** True while requests are paused because the browser is offline. */
  offline: boolean;
}

/** Only a failed connection is the user's network; anything else is on our side. */
function clientErrorReason(error: Error): string {
  return error instanceof ApiError && error.code === "NETWORK"
    ? "We can't reach the server. Check your connection."
    : "Our server couldn't send the latest prices. We'll keep retrying.";
}

export function useFreshness(
  meta: SnapshotMeta,
  receivedAt: number,
  connection: ConnectionState,
): FreshnessState {
  const now = useNow();
  // Before mount, classify using the age reported in the response itself.
  const ageMs = dataAgeMs(meta, receivedAt, now ?? receivedAt);
  const freshness = classifyFreshness(ageMs, meta.refreshIntervalMs);

  let reason: string | null = null;
  // Offline requests pause rather than fail, so this must be checked separately from errors.
  if (connection.offline) reason = "You're offline. Prices will update when you reconnect.";
  else if (connection.error) reason = clientErrorReason(connection.error);
  else if (meta.lastRefreshFailure) reason = PROVIDER_REASONS[meta.lastRefreshFailure.code];

  return {
    freshness,
    ageMs: now === null ? null : ageMs,
    reason,
    refreshIntervalMs: meta.refreshIntervalMs,
    fetchedAt: meta.fetchedAt,
  };
}
