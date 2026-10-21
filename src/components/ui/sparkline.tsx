import { seriesChangePct } from "@/lib/chart";
import { formatPercentChange } from "@/lib/format";

const WIDTH = 96;
const HEIGHT = 28;
const PAD = 2;

const STROKE = { up: "var(--up)", down: "var(--down)", flat: "var(--text-muted)" } as const;

/**
 * A compact 7-day trend. Colour follows the rounded 7-day change, the same
 * rule as every other change on the page, and the change is read out for
 * screen readers since the line itself is decorative.
 */
export function Sparkline({ values }: { values: readonly number[] | null }) {
  if (!values || values.length < 2) {
    return (
      <span className="text-muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No 7-day trend available</span>
      </span>
    );
  }

  const change = formatPercentChange(seriesChangePct(values));
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * WIDTH;
      const y = PAD + (1 - (value - min) / range) * (HEIGHT - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <span className="inline-flex">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        aria-hidden="true"
        className="overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke={STROKE[change.direction ?? "flat"]}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">7-day trend: {change.label}</span>
    </span>
  );
}
