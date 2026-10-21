/**
 * Picks `maxPoints` evenly spaced samples, always keeping the first and last
 * point so the trend's start, end and direction are exact.
 */
export function downsample(values: readonly number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return [...values];
  if (maxPoints < 2) return values.slice(-1);
  const step = (values.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => values[Math.round(i * step)]!);
}
