import { formatPercentChange } from "@/lib/format";
import { ArrowDownIcon, ArrowUpIcon } from "./icons";

const toneClass = { up: "text-up", down: "text-down", flat: "text-muted" } as const;

/**
 * A signed percentage. Direction is conveyed by sign, arrow and colour together,
 * never colour alone, and always matches the rounded number on screen.
 */
export function PriceChange({
  value,
  className = "",
}: {
  value: number | null;
  className?: string;
}) {
  const { text, label, direction } = formatPercentChange(value);
  if (direction === null) {
    return (
      <span className={`text-muted ${className}`} aria-label="Not available">
        {text}
      </span>
    );
  }
  const Arrow = direction === "up" ? ArrowUpIcon : direction === "down" ? ArrowDownIcon : null;
  return (
    <span
      className={`inline-flex items-center justify-end gap-0.5 tabular-nums ${toneClass[direction]} ${className}`}
    >
      {Arrow && <Arrow className="size-3 shrink-0" />}
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
