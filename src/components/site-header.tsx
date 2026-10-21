import Link from "next/link";
import { CommandPaletteButton } from "./command/command-palette-button";

export function SiteHeader() {
  return (
    <div className="border-b border-border bg-surface/70 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <div className="flex items-center gap-5 text-sm">
          <Link href="/" className="font-semibold tracking-tight">
            Crypto Markets
          </Link>
          <Link href="/compare" className="text-muted transition-colors hover:text-fg">
            Compare
          </Link>
        </div>
        <CommandPaletteButton />
      </nav>
    </div>
  );
}
