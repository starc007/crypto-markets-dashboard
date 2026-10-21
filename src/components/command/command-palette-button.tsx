"use client";

import { SearchIcon } from "../ui/icons";
import { openCommandPalette } from "./open-command-palette";

export function CommandPaletteButton() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-keyshortcuts="Meta+K Control+K"
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface pr-1.5 pl-3 text-sm text-muted shadow-card transition-colors hover:text-fg"
    >
      <SearchIcon className="size-4" />
      <span>Jump to asset</span>
      <kbd className="rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-xs">
        ⌘K
      </kbd>
    </button>
  );
}
