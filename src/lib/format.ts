/**
 * Display formatting for financial values.
 *
 * Rules, each covered by tests:
 * - Missing or non-finite values render as an em dash, never as 0.
 * - A non-zero price never rounds to "$0.00"; small prices keep 4 significant digits.
 * - Output never uses scientific notation (`5.16e-6` → "$0.00000516").
 * - The direction (and colour) of a change is decided by the rounded value the
 *   user sees, so "-0.004%" shows as "0.00%", neutral, not red "-0.00%".
 *
 * The locale is fixed so server and client render identical strings.
 */

export const LOCALE = "en-US";
export const NOT_AVAILABLE = "—";
const MINUS = "−";

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let instance = formatters.get(key);
  if (!instance) {
    instance = new Intl.NumberFormat(LOCALE, options);
    formatters.set(key, instance);
  }
  return instance;
}

function isPresent(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Fraction digits that keep 4 significant digits for |value| < 1. */
function fractionDigitsForSmall(abs: number): number {
  const leadingZeros = Math.max(0, Math.ceil(-Math.log10(abs)) - 1);
  return Math.min(100, leadingZeros + 4);
}

export function formatUsdPrice(value: number | null | undefined): string {
  if (!isPresent(value)) return NOT_AVAILABLE;
  const abs = Math.abs(value);
  const maximumFractionDigits = abs === 0 || abs >= 1 ? 2 : fractionDigitsForSmall(abs);
  return formatter({
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(value);
}

/** Compact currency for large aggregates: "$1.67T", "$27.98B", "$812.34". */
export function formatUsdCompact(value: number | null | undefined): string {
  if (!isPresent(value)) return NOT_AVAILABLE;
  return formatter({
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Full-precision currency, used for tooltips and accessible labels next to compact values. */
export function formatUsdFull(value: number | null | undefined): string {
  if (!isPresent(value)) return NOT_AVAILABLE;
  return Math.abs(value) < 1
    ? formatUsdPrice(value)
    : formatter({ style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (!isPresent(value)) return NOT_AVAILABLE;
  return formatter({ notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export type ChangeDirection = "up" | "down" | "flat";

export interface FormattedChange {
  /** e.g. "+2.23%", "−0.57%", "0.00%", or an em dash. */
  text: string;
  /** Screen-reader phrasing, e.g. "up 2.23%". */
  label: string;
  direction: ChangeDirection | null;
}

export function formatPercentChange(value: number | null | undefined): FormattedChange {
  if (!isPresent(value)) {
    return { text: NOT_AVAILABLE, label: "not available", direction: null };
  }
  const magnitude = formatter({
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const roundedIsZero = Number(magnitude.replace(/,/g, "")) === 0;
  const direction: ChangeDirection = roundedIsZero ? "flat" : value > 0 ? "up" : "down";

  const sign = direction === "up" ? "+" : direction === "down" ? MINUS : "";
  const label = direction === "flat" ? `unchanged, ${magnitude}%` : `${direction} ${magnitude}%`;
  return { text: `${sign}${magnitude}%`, label, direction };
}

/** Coarse duration: "45s", "3 min", "2 h", "3 d". */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export function formatRelativeAge(ageMs: number): string {
  return ageMs < 10_000 ? "just now" : `${formatDuration(ageMs)} ago`;
}
