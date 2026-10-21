"use client";

import { useId, useMemo } from "react";
import { useChartScrubber } from "@/hooks/use-chart-scrubber";
import { hourlyPointTime, pointTimeFormat, seriesChangePct } from "@/lib/chart";
import { formatPercentChange, formatPrice } from "@/lib/format";
import type { Currency } from "@/shared/currency";
import { ChartDot, Crosshair, RevealClip } from "../charts/chart-parts";
import { changeToneClass } from "../ui/change-tone";

const WIDTH = 640;
const HEIGHT = 220;
const PADDING_Y = 12;

interface PriceChartProps {
  prices: readonly number[];
  currency: Currency;
  /** Timestamp of the last point; earlier points are assumed hourly. */
  endTime: number;
  assetName: string;
}

/**
 * A dependency-free 7-day line chart. Pointer users get a crosshair; keyboard
 * users can focus the chart and step through points with the arrow keys.
 * Point times are approximate because CoinGecko's sparkline has no timestamps.
 */
export function PriceChart({ prices, currency, endTime, assetName }: PriceChartProps) {
  const money = (value: number) => formatPrice(value, currency);
  const gradientId = useId();
  const clipId = useId();
  const readoutId = useId();
  const { active, fromKeyboard, handlers } = useChartScrubber(prices.length);

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

  const change = formatPercentChange(seriesChangePct(prices));
  const activePrice = active === null ? null : prices[active]!;

  const summary =
    `${assetName} over 7 days: from ${money(prices[0]!)} to ${money(prices.at(-1)!)}, ` +
    `${change.label}. Low ${money(geometry.min)}, high ${money(geometry.max)}.`;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">7-day price</span>
        <span
          id={readoutId}
          aria-live={fromKeyboard ? "polite" : "off"}
          className="text-muted tabular-nums"
        >
          {active !== null && activePrice !== null ? (
            <>
              <span className="font-medium text-fg">{money(activePrice)}</span> · ≈{" "}
              {pointTimeFormat.format(hourlyPointTime(active, prices.length, endTime))}
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
        {...handlers}
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
            <RevealClip id={clipId} width={WIDTH} height={HEIGHT} />
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <path d={geometry.area} fill={`url(#${gradientId})`} />
            <path
              d={geometry.line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </g>
          {active !== null && <Crosshair x={geometry.x(active)} height={HEIGHT} />}
        </svg>
        {active !== null && activePrice !== null && (
          <ChartDot
            color="var(--accent)"
            left={`${(geometry.x(active) / WIDTH) * 100}%`}
            top={`${(geometry.y(activePrice) / HEIGHT) * 100}%`}
          />
        )}
      </div>
      <p className="text-xs text-muted">
        <span className="mr-1">7d change</span>
        <span className={changeToneClass(change.direction)}>{change.text}</span>
        <span> · Hourly points, times approximate</span>
      </p>
    </figure>
  );
}
