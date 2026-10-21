"use client";

import { motion } from "motion/react";
import { FOLLOW_SPRING, REVEAL_TRANSITION } from "@/lib/chart";

/** A clip path that reveals series left to right; a clip keeps strokes crisp, unlike dash tricks. */
export function RevealClip({ id, width, height }: { id: string; width: number; height: number }) {
  return (
    <clipPath id={id}>
      <motion.rect
        x={0}
        y={0}
        height={height}
        initial={{ width: 0 }}
        animate={{ width }}
        transition={REVEAL_TRANSITION}
      />
    </clipPath>
  );
}

/** Vertical guide at the inspected point, in SVG units. */
export function Crosshair({ x, height }: { x: number; height: number }) {
  return (
    <motion.line
      initial={false}
      animate={{ x1: x, x2: x }}
      transition={FOLLOW_SPRING}
      y1={0}
      y2={height}
      stroke="var(--text-muted)"
      strokeDasharray="3 3"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/**
 * A marker positioned in percent of the chart box, so it stays round while
 * the SVG stretches. It appears at its target rather than flying in from 0.
 */
export function ChartDot({ left, top, color }: { left: string; top: string; color: string }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-card"
      style={{ background: color }}
      initial={{ scale: 0, left, top }}
      animate={{ scale: 1, left, top }}
      transition={{ ...FOLLOW_SPRING, scale: { duration: 0.15 } }}
    />
  );
}
