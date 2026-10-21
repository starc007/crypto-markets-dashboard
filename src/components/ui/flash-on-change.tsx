"use client";

import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

interface FlashOnChangeProps {
  value: number | null;
  /** Changing this (e.g. the display currency) re-baselines without flashing. */
  resetKey?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Briefly tints its content green or red when `value` rises or falls between
 * renders, so users can see which prices just updated. The number itself
 * changes instantly: rolling digits would show prices that never existed.
 */
export function FlashOnChange({ value, resetKey, children, className = "" }: FlashOnChangeProps) {
  const [tracked, setTracked] = useState({ value, resetKey });
  const [flash, setFlash] = useState<{ direction: "up" | "down"; id: number } | null>(null);

  // Adjusting state while rendering is React's recommended way to react to a prop change.
  if (tracked.value !== value || tracked.resetKey !== resetKey) {
    const previous = tracked.value;
    setTracked({ value, resetKey });
    if (tracked.resetKey === resetKey && previous !== null && value !== null) {
      setFlash((current) => ({
        direction: value > previous ? "up" : "down",
        id: (current?.id ?? 0) + 1,
      }));
    }
  }

  return (
    <span className={`relative inline-block ${className}`}>
      {flash && (
        <motion.span
          key={flash.id}
          aria-hidden="true"
          className="absolute -inset-x-1.5 -inset-y-0.5 rounded-md"
          style={{ background: flash.direction === "up" ? "var(--up-flash)" : "var(--down-flash)" }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      )}
      <span className="relative">{children}</span>
    </span>
  );
}
