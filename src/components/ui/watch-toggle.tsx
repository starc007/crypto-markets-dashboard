"use client";

import { StarIcon } from "./icons";

interface WatchToggleProps {
  assetName: string;
  watched: boolean;
  onToggle: () => void;
  className?: string;
}

export function WatchToggle({ assetName, watched, onToggle, className = "" }: WatchToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={`Watch ${assetName}`}
      onClick={onToggle}
      className={`inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-surface-muted ${
        watched ? "text-amber-500" : "text-muted hover:text-fg"
      } ${className}`}
    >
      <StarIcon filled={watched} className="size-4" />
    </button>
  );
}
