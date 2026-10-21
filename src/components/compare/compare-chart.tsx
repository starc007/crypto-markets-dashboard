"use client";

import { motion } from "motion/react";
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatPercentChange } from "@/lib/format";

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
const HOUR_MS = 60 * 60_000;
const FOLLOW = { type: "spring", stiffness: 700, damping: 45, mass: 0.6 } as const;

const timeFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

function changeClass(direction: string | null): string {
  return direction === "up" ? "text-up" : direction === "down" ? "text-down" : "text-muted";
}

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
  const [active, setActive] = useState<number | null>(null);
  const points = series[0]?.values.length ?? 0;

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

  const pointTime = (i: number) => endTime - (points - 1 - i) * HOUR_MS;
  const index = active ?? points - 1;
  const readings = series
    .map((s) => ({ s, value: s.values[index]! }))
    .sort((a, b) => b.value - a.value);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * (points - 1)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => Math.max(0, i - 1),
      ArrowRight: (i) => Math.min(points - 1, i + 1),
      Home: () => 0,
      End: () => points - 1,
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setActive((i) => move(i ?? points - 1));
  }

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
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="relative touch-pan-y rounded-lg"
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="block h-72 w-full sm:h-80"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <motion.rect
                x={0}
                y={0}
                height={HEIGHT}
                initial={{ width: 0 }}
                animate={{ width: WIDTH }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              />
            </clipPath>
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
          {active !== null && (
            <motion.line
              initial={false}
              animate={{ x1: geometry.x(active), x2: geometry.x(active) }}
              transition={FOLLOW}
              y1={0}
              y2={HEIGHT}
              stroke="var(--text-muted)"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {active !== null &&
          series.map((s) => (
            <motion.span
              key={s.id}
              aria-hidden="true"
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
              style={{ background: s.color }}
              initial={false}
              animate={{
                left: `${(geometry.x(active) / WIDTH) * 100}%`,
                top: `${(geometry.y(s.values[active]!) / HEIGHT) * 100}%`,
              }}
              transition={FOLLOW}
            />
          ))}

        <span className="pointer-events-none absolute top-1 left-1 text-xs text-muted tabular-nums">
          {formatPercentChange(geometry.max).text}
        </span>
        <span className="pointer-events-none absolute bottom-1 left-1 text-xs text-muted tabular-nums">
          {formatPercentChange(geometry.min).text}
        </span>
      </div>

      <figcaption id={readoutId} aria-live="polite" className="flex flex-col gap-1.5">
        <p className="text-xs text-muted">
          {active === null ? "Change over the period" : `≈ ${timeFormat.format(pointTime(active))}`}
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
                <span className={`tabular-nums ${changeClass(change.direction)}`}>
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
