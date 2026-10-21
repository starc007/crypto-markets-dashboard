/** Shared constants and maths for the line charts (asset detail, compare). */

export const HOUR_MS = 60 * 60_000;

/** Fast enough to track the pointer, soft enough to read as motion rather than jitter. */
export const FOLLOW_SPRING = { type: "spring", stiffness: 700, damping: 45, mass: 0.6 } as const;

/** Reveal for a newly drawn series, left to right like time passing. */
export const REVEAL_TRANSITION = { duration: 0.9, ease: [0.22, 1, 0.36, 1] } as const;

/** Client-only (charts render interactively), so the viewer's time zone is fine. */
export const pointTimeFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Time of point `index` in an hourly series that ends at `endTime`.
 * Approximate: CoinGecko's sparkline points carry no timestamps.
 */
export function hourlyPointTime(index: number, length: number, endTime: number): number {
  return endTime - (length - 1 - index) * HOUR_MS;
}

/** Percent change from the first to the last value, or null when it can't be computed. */
export function seriesChangePct(values: readonly number[]): number | null {
  const first = values[0];
  const last = values[values.length - 1];
  return first !== undefined && last !== undefined && first > 0 ? (last / first - 1) * 100 : null;
}
