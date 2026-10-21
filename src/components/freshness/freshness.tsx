"use client";

import { AnimatePresence, motion } from "motion/react";
import type { FreshnessState } from "@/hooks/use-freshness";
import { formatDuration, formatRelativeAge } from "@/lib/format";
import type { Freshness } from "@/lib/freshness";
import { AlertIcon } from "../ui/icons";

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
  const { freshness, ageMs, refreshIntervalMs, fetchedAt } = state;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="relative inline-flex size-2">
          {/* One ripple per new snapshot: it marks arrivals without implying a live stream. */}
          <motion.span
            key={fetchedAt}
            className={`absolute inset-0 rounded-full ${DOT_CLASS[freshness]}`}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <span
            className={`relative size-2 rounded-full transition-colors duration-500 ${DOT_CLASS[freshness]}`}
          />
        </span>
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
        : "Prices are current, but updates are interrupted.";

  const tone =
    freshness === "stale"
      ? "border-danger-border bg-danger-bg text-danger"
      : "border-warn-border bg-warn-bg text-warn";

  return (
    <div role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {visible && (
          <motion.div
            key="banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className={`flex gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${tone}`}
            >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
