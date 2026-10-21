/**
 * Brand colours are chosen by the brand, not for our background: Hyperliquid
 * is pale mint and Canton is pale yellow. We keep the curated colour as the
 * source of truth and derive a display accent that meets the WCAG 3:1 contrast
 * ratio for non-text UI (chart lines, rings, markers).
 */

/** Must match `--surface` in globals.css. */
export const SURFACE = "#FFFFFF";

export const MIN_GRAPHIC_CONTRAST = 3;

type Rgb = readonly [number, number, number];

export function parseHex(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) throw new Error(`Invalid hex colour: ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((i) => from[i]! + (to[i]! - from[i]!) * amount) as unknown as Rgb;
}

/**
 * Returns `color` unchanged when it already contrasts with `background`;
 * otherwise mixes it towards white (on dark backgrounds) or black (on light
 * ones) in small steps until it does, so the hue stays recognisable.
 */
export function ensureContrast(
  color: string,
  background: string,
  minRatio = MIN_GRAPHIC_CONTRAST,
): string {
  const normalized = toHex(parseHex(color));
  if (contrastRatio(normalized, background) >= minRatio) return normalized;

  const target: Rgb = relativeLuminance(background) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  const source = parseHex(normalized);
  for (let step = 1; step <= 20; step++) {
    const candidate = toHex(mix(source, target, step / 20));
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return toHex(target);
}

/** The brand colour, adjusted only if needed to stay visible on our surface. */
export function deriveAccent(brand: string): string {
  return ensureContrast(brand, SURFACE);
}

/** Sets `--accent`, which Tailwind exposes as the `accent` colour (e.g. `ring-accent`). */
export function accentVars(accent: string): Record<"--accent", string> {
  return { "--accent": accent };
}
