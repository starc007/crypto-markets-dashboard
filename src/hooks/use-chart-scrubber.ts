"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Pointer and keyboard inspection for a chart with `points` samples.
 *
 * `fromKeyboard` tells the chart whether the last move came from the keys, so
 * its readout can be a live region only then: announcing every pointer move
 * would flood screen readers.
 */
export function useChartScrubber(points: number) {
  const [active, setActive] = useState<number | null>(null);
  const [fromKeyboard, setFromKeyboard] = useState(false);
  const lastIndex = Math.max(0, points - 1);

  const handlers = {
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      setFromKeyboard(false);
      setActive(Math.round(ratio * lastIndex));
    },
    onPointerLeave() {
      setActive(null);
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const moves: Record<string, (i: number) => number> = {
        ArrowLeft: (i) => Math.max(0, i - 1),
        ArrowRight: (i) => Math.min(lastIndex, i + 1),
        Home: () => 0,
        End: () => lastIndex,
      };
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      setFromKeyboard(true);
      setActive((i) => move(i ?? lastIndex));
    },
    onBlur() {
      setActive(null);
    },
  };

  return { active, fromKeyboard, handlers };
}
