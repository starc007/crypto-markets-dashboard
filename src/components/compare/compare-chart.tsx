"use client";

import { motion } from "motion/react";
import { useId, useMemo } from "react";
import { useChartScrubber } from "@/hooks/use-chart-scrubber";
import { hourlyPointTime, pointTimeFormat } from "@/lib/chart";
import { formatPercentChange } from "@/lib/format";
import { ChartDot, Crosshair, RevealClip } from "../charts/chart-parts";
import { changeToneClass } from "../ui/change-tone";

export interface CompareSeries {
  id: string;
  symbol: string;
  name: string;
  color: string;
  /** Percent change from the shared start, oldest first. */
  values: number[];
}

const WIDTH = 720;
const HEIGHT = 300;
const PAD_Y = 16;

/**
 * Overlaid performance lines, each in the asset's brand colour, all starting
 * at 0%. A dashed baseline marks "no change". Pointer and arrow keys inspect
 * every series at the same moment.
 */
export function CompareChart({
  series,
  endTime,
}: {
  series: readonly CompareSeries[];
  endTime: number;
}) {
  const clipId = useId();
  const readoutId = useId();
  const points = series[0]?.values.length ?? 0;
  const { active, fromKeyboard, handlers } = useChartScrubber(points);

  const geometry = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const min = Math.min(0, ...all);
    const max = Math.max(0, ...all);
    const range = max - min || 1;
    const x = (i: number) => (i / Math.max(1, points - 1)) * WIDTH;
    const y = (v: number) => PAD_Y + (1 - (v - min) / range) * (HEIGHT - 2 * PAD_Y);
    const paths = series.map((s) =>
      s.values
        .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
        .join(""),
    );
    return { min, max, x, y, paths };
  }, [series, points]);

  if (points < 2) return null;

  const index = active ?? points - 1;
  const readings = series
    .map((s) => ({ s, value: s.values[index]! }))
    .sort((a, b) => b.value - a.value);
  const summary = series
    .map((s) => `${s.name} ${formatPercentChange(s.values.at(-1)!).label}`)
    .join(", ");

  return (
    <figure className="flex flex-col gap-3">
      <div
        role="group"
        aria-roledescription="chart"
        aria-label={`Performance over the period: ${summary}.`}
        aria-describedby={readoutId}
        tabIndex={0}
        {...handlers}
        className="relative touch-pan-y rounded-lg"
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="block h-72 w-full sm:h-80"
          aria-hidden="true"
        >
          <defs>
            <RevealClip id={clipId} width={WIDTH} height={HEIGHT} />
          </defs>
          <line
            x1={0}
            x2={WIDTH}
            y1={geometry.y(0)}
            y2={geometry.y(0)}
            stroke="var(--text-muted)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          <g clipPath={`url(#${clipId})`}>
            {series.map((s, i) => (
              <motion.path
                key={s.id}
                d={geometry.paths[i]}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={false}
                animate={{ d: geometry.paths[i] }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            ))}
          </g>
          {active !== null && <Crosshair x={geometry.x(active)} height={HEIGHT} />}
        </svg>

        {active !== null &&
          series.map((s) => (
            <ChartDot
              key={s.id}
              color={s.color}
              left={`${(geometry.x(active) / WIDTH) * 100}%`}
              top={`${(geometry.y(s.values[active]!) / HEIGHT) * 100}%`}
            />
          ))}

        <span className="pointer-events-none absolute top-1 left-1 text-xs text-muted tabular-nums">
          {formatPercentChange(geometry.max).text}
        </span>
        <span className="pointer-events-none absolute bottom-1 left-1 text-xs text-muted tabular-nums">
          {formatPercentChange(geometry.min).text}
        </span>
      </div>

      <figcaption
        id={readoutId}
        aria-live={fromKeyboard ? "polite" : "off"}
        className="flex flex-col gap-1.5"
      >
        <p className="text-xs text-muted">
          {active === null
            ? "Change over the period"
            : `≈ ${pointTimeFormat.format(hourlyPointTime(active, points, endTime))}`}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {readings.map(({ s, value }) => {
            const change = formatPercentChange(value);
            return (
              <li key={s.id} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="font-medium">{s.symbol}</span>
                <span className={`tabular-nums ${changeToneClass(change.direction)}`}>
                  {change.text}
                </span>
              </li>
            );
          })}
        </ul>
      </figcaption>
    </figure>
  );
}
