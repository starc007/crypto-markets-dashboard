import { formatPercentChange } from "@/lib/format";
import { changeToneClass } from "./change-tone";
import { ArrowDownIcon, ArrowUpIcon } from "./icons";

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
      // aria-label is ignored on plain spans by many screen readers, so use visually hidden text.
      <span className={`text-muted ${className}`}>
        <span aria-hidden="true">{text}</span>
        <span className="sr-only">Not available</span>
      </span>
    );
  }
  const Arrow = direction === "up" ? ArrowUpIcon : direction === "down" ? ArrowDownIcon : null;
  return (
    <span
      className={`inline-flex items-center justify-end gap-0.5 tabular-nums ${changeToneClass(direction)} ${className}`}
    >
      {Arrow && <Arrow className="size-3 shrink-0" />}
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
