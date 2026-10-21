import type { ChangeDirection } from "@/lib/format";

/** Text colour for a change, from its rounded direction (see `formatPercentChange`). */
export function changeToneClass(direction: ChangeDirection | null): string {
  return direction === "up" ? "text-up" : direction === "down" ? "text-down" : "text-muted";
}
