"use client";

import { motion } from "motion/react";
import { StarIcon } from "./icons";

interface WatchToggleProps {
  assetName: string;
  watched: boolean;
  onToggle: () => void;
  className?: string;
}

export function WatchToggle({ assetName, watched, onToggle, className = "" }: WatchToggleProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={watched}
      aria-label={`Watch ${assetName}`}
      onClick={onToggle}
      whileTap={{ scale: 0.85 }}
      className={`inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-surface-muted ${
        watched ? "text-amber-600" : "text-muted hover:text-fg"
      } ${className}`}
    >
      {/* Re-keyed on change so starring pops; un-starring just settles. */}
      <motion.span
        key={String(watched)}
        initial={watched ? { scale: 0.4, rotate: -30 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        className="inline-flex"
      >
        <StarIcon filled={watched} className="size-4" />
      </motion.span>
    </motion.button>
  );
}
