"use client";

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatPercentChange, formatPrice } from "@/lib/format";
import type { Currency } from "@/shared/currency";

const WIDTH = 640;
const HEIGHT = 220;
const PADDING_Y = 12;
const HOUR_MS = 60 * 60_000;

interface PriceChartProps {
  prices: readonly number[];
  currency: Currency;
  /** Timestamp of the last point; earlier points are assumed hourly. */
  endTime: number;
  assetName: string;
}

const timeFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * A dependency-free 7-day line chart. Pointer users get a crosshair; keyboard
 * users can focus the chart and step through points with the arrow keys.
 * Point times are approximate because CoinGecko's sparkline has no timestamps.
 */
export function PriceChart({ prices, currency, endTime, assetName }: PriceChartProps) {
  const money = (value: number) => formatPrice(value, currency);
  const gradientId = useId();
  const readoutId = useId();
  const [active, setActive] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || Math.abs(max) || 1;
    const x = (i: number) => (i / (prices.length - 1)) * WIDTH;
    const y = (p: number) => PADDING_Y + (1 - (p - min) / range) * (HEIGHT - 2 * PADDING_Y);
    const line = prices.map(
      (p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p).toFixed(2)}`,
    );
    return {
      min,
      max,
      x,
      y,
      line: line.join(""),
      area: `${line.join("")}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z`,
    };
  }, [prices]);

  const first = prices[0]!;
  const last = prices[prices.length - 1]!;
  const change = formatPercentChange(first > 0 ? (last / first - 1) * 100 : null);
  const pointTime = (i: number) => endTime - (prices.length - 1 - i) * HOUR_MS;

  const summary =
    `${assetName} over 7 days: from ${money(first)} to ${money(last)}, ` +
    `${change.label}. Low ${money(geometry.min)}, high ${money(geometry.max)}.`;

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * (prices.length - 1)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const lastIndex = prices.length - 1;
    const step: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => Math.max(0, i - 1),
      ArrowRight: (i) => Math.min(lastIndex, i + 1),
      Home: () => 0,
      End: () => lastIndex,
    };
    const move = step[event.key];
    if (!move) return;
    event.preventDefault();
    setActive((i) => move(i ?? lastIndex));
  }

  const activePrice = active === null ? null : prices[active]!;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">7-day price</span>
        <span id={readoutId} aria-live="polite" className="text-muted tabular-nums">
          {activePrice !== null && active !== null ? (
            <>
              <span className="font-medium text-fg">{money(activePrice)}</span> · ≈{" "}
              {timeFormat.format(pointTime(active))}
            </>
          ) : (
            <>
              Low {money(geometry.min)} · High {money(geometry.max)}
            </>
          )}
        </span>
      </figcaption>
      <div
        role="group"
        aria-roledescription="chart"
        aria-label={summary}
        aria-describedby={readoutId}
        tabIndex={0}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="relative touch-pan-y rounded-lg"
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="block h-56 w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          {active !== null && activePrice !== null && (
            <line
              x1={geometry.x(active)}
              x2={geometry.x(active)}
              y1={0}
              y2={HEIGHT}
              stroke="var(--text-muted)"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {active !== null && activePrice !== null && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
            style={{
              left: `${(geometry.x(active) / WIDTH) * 100}%`,
              top: `${(geometry.y(activePrice) / HEIGHT) * 100}%`,
            }}
          />
        )}
      </div>
      <p className="text-xs text-muted">
        <span className="mr-1">7d change</span>
        <span
          className={
            change.direction === "up"
              ? "text-up"
              : change.direction === "down"
                ? "text-down"
                : undefined
          }
        >
          {change.text}
        </span>
        <span> · Hourly points, times approximate</span>
      </p>
    </figure>
  );
}
