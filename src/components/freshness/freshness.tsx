"use client";

import { useNow } from "@/hooks/use-now";
import type { ApiError } from "@/lib/api-client";
import { formatDuration, formatRelativeAge } from "@/lib/format";
import { classifyFreshness, dataAgeMs, type Freshness } from "@/lib/freshness";
import type { SnapshotMeta, UpstreamErrorCode } from "@/shared/market";
import { AlertIcon } from "../ui/icons";

export interface FreshnessState {
  freshness: Freshness;
  /** Null until mounted: relative times are client-only to avoid hydration mismatches. */
  ageMs: number | null;
  /** Why data may be old, if we know. */
  reason: string | null;
  /** How often the server refreshes, so "updated 4 min ago" reads as expected rather than broken. */
  refreshIntervalMs: number;
}

const PROVIDER_REASONS: Record<UpstreamErrorCode, string> = {
  RATE_LIMITED: "Our data provider is limiting requests. We'll keep retrying automatically.",
  UNAUTHORIZED: "Our data provider rejected our credentials.",
  UNAVAILABLE: "Our data provider isn't responding. We'll keep retrying automatically.",
  TIMEOUT: "Our data provider isn't responding. We'll keep retrying automatically.",
  INVALID_RESPONSE:
    "Our data provider sent data we couldn't verify, so we kept the last good prices.",
};

export function useFreshness(
  meta: SnapshotMeta,
  receivedAt: number,
  clientError: ApiError | Error | null,
): FreshnessState {
  const now = useNow();
  // Before mount, classify using the age reported in the response itself.
  const ageMs = dataAgeMs(meta, receivedAt, now ?? receivedAt);
  const freshness = classifyFreshness(ageMs, meta.refreshIntervalMs);

  let reason: string | null = null;
  if (clientError) reason = "We can't reach the server. Check your connection.";
  else if (meta.lastRefreshFailure) reason = PROVIDER_REASONS[meta.lastRefreshFailure.code];

  return {
    freshness,
    ageMs: now === null ? null : ageMs,
    reason,
    refreshIntervalMs: meta.refreshIntervalMs,
  };
}

/*
 * "Up to date" rather than "Live": prices refresh every few minutes, and a
 * trading UI shouldn't claim real-time data it doesn't have.
 */
const LABELS: Record<Freshness, string> = {
  live: "Up to date",
  delayed: "Delayed",
  stale: "Stale",
};
const DOT_CLASS: Record<Freshness, string> = {
  live: "bg-up",
  delayed: "bg-amber-500",
  stale: "bg-down",
};

export function FreshnessIndicator({ state }: { state: FreshnessState }) {
  const { freshness, ageMs, refreshIntervalMs } = state;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className={`size-2 rounded-full ${DOT_CLASS[freshness]}`} />
        <span className="font-medium text-fg">{LABELS[freshness]}</span>
      </span>
      {ageMs !== null && <span className="tabular-nums">· updated {formatRelativeAge(ageMs)}</span>}
      <span>· refreshes every {formatDuration(refreshIntervalMs)}</span>
    </p>
  );
}

/**
 * Explains why data may be outdated. The live region only contains text that
 * changes when the situation changes; the ticking age sits outside it so
 * screen readers aren't interrupted every second.
 */
export function FreshnessBanner({ state }: { state: FreshnessState }) {
  const { freshness, ageMs, reason } = state;
  const visible = freshness !== "live" || reason !== null;

  const headline =
    freshness === "stale"
      ? "Prices are out of date. Don't rely on them for trading decisions."
      : freshness === "delayed"
        ? "Prices may be delayed."
        : "Prices are current, but the latest refresh had a problem.";

  const tone =
    freshness === "stale"
      ? "border-danger-border bg-danger-bg text-danger"
      : "border-warn-border bg-warn-bg text-warn";

  return (
    <div role="status" aria-live="polite">
      {visible && (
        <div className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${tone}`}>
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{headline}</p>
            {reason && <p>{reason}</p>}
            {ageMs !== null && freshness !== "live" && (
              <p aria-hidden="true" className="tabular-nums opacity-80">
                Last updated {formatRelativeAge(ageMs)}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
