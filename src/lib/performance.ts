export interface AlignedPerformance {
  /** Percent change from the window's first point, one array per input, all the same length. */
  series: number[][];
  /** Number of hourly steps the window covers (points − 1). */
  spanHours: number;
}

/**
 * Puts hourly price series on a common footing for comparison. Every series
 * ends "now", but some assets have less history, so all are right-aligned
 * and trimmed to the shortest one. Each is then rebased to 0% at the shared
 * start, so the chart compares performance rather than price levels.
 */
export function alignPerformance(prices: readonly (readonly number[])[]): AlignedPerformance {
  const usable = prices.filter((p) => p.length >= 2);
  if (usable.length !== prices.length || prices.length === 0) {
    return { series: [], spanHours: 0 };
  }
  const length = Math.min(...prices.map((p) => p.length));
  const series = prices.map((p) => {
    const window = p.slice(p.length - length);
    const base = window[0]!;
    return window.map((value) => (base > 0 ? (value / base - 1) * 100 : 0));
  });
  return { series, spanHours: length - 1 };
}
