"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useCurrencyPreference, useDisplayCurrency } from "@/hooks/use-currency";
import { useMarketsSnapshot } from "@/hooks/use-market-data";
import { toDisplayCoin, type DisplayCoin } from "@/lib/currency-conversion";
import { formatPrice } from "@/lib/format";
import { searchAssets } from "@/lib/search";
import { CURRENCIES, type Currency } from "@/shared/currency";
import { AssetAvatar } from "../ui/asset-avatar";
import { SearchIcon } from "../ui/icons";
import { PriceChange } from "../ui/price-change";
import { OPEN_COMMAND_PALETTE_EVENT } from "./open-command-palette";

type Item =
  | { kind: "asset"; id: string; coin: DisplayCoin }
  | { kind: "command"; id: string; label: string; hint: string; run: () => void };

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * ⌘K / Ctrl+K (or "/") anywhere opens a quick-jump palette. It uses the
 * accessible combobox pattern: focus stays in the input, arrow keys move the
 * active option (announced via aria-activedescendant), Enter runs it.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const combo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !isTypingTarget(event.target);
      if (combo || slash) {
        event.preventDefault();
        setOpen((current) => !current || !combo);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  return (
    <AnimatePresence>
      {open && <PaletteDialog key="palette" onClose={() => setOpen(false)} />}
    </AnimatePresence>
  );
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { data, isPending, isError } = useMarketsSnapshot();
  const { currency: requested, setCurrency } = useCurrencyPreference("USD");
  const display = useDisplayCurrency(requested, data?.fx ?? null);
  const { currency } = display.converter;

  /*
   * A native modal dialog makes the rest of the page inert, so Tab can't
   * leave the palette and assistive tech treats it as modal. Focus returns to
   * wherever the user was when it closes.
   */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.showModal();
    return () => previous?.focus?.();
  }, []);

  const items = useMemo<Item[]>(() => {
    const coins = (data?.coins ?? []).map((coin) => toDisplayCoin(coin, display.converter));
    const assets: Item[] = searchAssets(coins, query, 7).map((coin) => ({
      kind: "asset",
      id: coin.id,
      coin,
    }));
    const commands: Item[] = [
      ...CURRENCIES.filter((c) => c !== currency).map((c) => ({
        kind: "command" as const,
        id: `currency-${c}`,
        label: `Show prices in ${c}`,
        hint: "Currency",
        run: () => setCurrency(c as Currency),
      })),
      {
        kind: "command",
        id: "compare",
        label: "Compare assets",
        hint: "Page",
        run: () => router.push("/compare"),
      },
      {
        kind: "command",
        id: "markets",
        label: "Go to all markets",
        hint: "Page",
        run: () => router.push("/"),
      },
    ];
    const q = query.trim().toLowerCase();
    return [
      ...assets,
      ...commands.filter(
        (c) => q === "" || (c.kind === "command" && c.label.toLowerCase().includes(q)),
      ),
    ];
  }, [data, display.converter, query, currency, setCurrency, router]);

  const safeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
  const activeItem = items[safeIndex];

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${safeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  function run(item: Item | undefined) {
    if (!item) return;
    onClose();
    if (item.kind === "asset") router.push(`/coins/${item.coin.id}`);
    else item.run();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((safeIndex + delta + items.length) % Math.max(1, items.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(activeItem);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`;
  const firstCommand = items.findIndex((item) => item.kind === "command");

  return (
    <motion.dialog
      ref={dialogRef}
      aria-label="Command palette"
      className="fixed inset-0 m-0 flex h-dvh max-h-none w-full max-w-none items-start justify-center bg-fg/20 px-4 pt-[12vh] backdrop-blur-[2px] backdrop:bg-transparent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      // Escape: close through React so the exit animation plays.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.12 } }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <SearchIcon className="size-4 shrink-0 text-muted" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeItem ? optionId(safeIndex) : undefined}
            aria-label="Search assets and commands"
            placeholder="Search assets and commands…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            className="h-14 w-full bg-transparent text-base placeholder:text-muted focus:outline-none"
          />
          <kbd className="rounded-md border border-border bg-surface-muted px-1.5 py-0.5 text-xs text-muted">
            Esc
          </kbd>
        </div>

        <ul ref={listRef} id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {isPending && <li className="px-3 py-6 text-center text-sm text-muted">Loading…</li>}
          {isError && !data && (
            <li className="px-3 py-6 text-center text-sm text-muted">
              Market data is unavailable right now.
            </li>
          )}
          {items.length === 0 && data && (
            <li className="px-3 py-6 text-center text-sm text-muted">No matches.</li>
          )}
          {items.map((item, index) => (
            <li key={item.id} role="presentation">
              {index === firstCommand && (
                <p
                  role="presentation"
                  className="px-3 pt-3 pb-1 text-xs font-medium tracking-wide text-muted uppercase"
                >
                  Commands
                </p>
              )}
              <div
                id={optionId(index)}
                role="option"
                aria-selected={index === safeIndex}
                data-index={index}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => run(item)}
                className="relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2"
              >
                {index === safeIndex && (
                  <motion.span
                    layoutId={`${listId}-highlight`}
                    className="absolute inset-0 rounded-lg bg-surface-muted"
                    transition={{ type: "spring", stiffness: 600, damping: 45 }}
                  />
                )}
                {item.kind === "asset" ? (
                  <>
                    <span className="relative">
                      <AssetAvatar
                        symbol={item.coin.symbol}
                        imageUrl={item.coin.imageUrl}
                        accent={item.coin.accent}
                        size={24}
                      />
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.coin.name}</span>
                      <span className="text-xs text-muted">{item.coin.symbol}</span>
                    </span>
                    <span className="relative text-right text-sm">
                      <span className="block font-medium tabular-nums">
                        {formatPrice(item.coin.price, currency)}
                      </span>
                      <PriceChange value={item.coin.change24hPct} className="text-xs" />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="relative flex-1 text-sm">{item.label}</span>
                    <span className="relative text-xs text-muted">{item.hint}</span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div
          aria-hidden="true"
          className="flex gap-4 border-t border-border px-4 py-2 text-xs text-muted"
        >
          <span>↑↓ to navigate</span>
          <span>↵ to open</span>
          <span>Esc to close</span>
        </div>
      </motion.div>
    </motion.dialog>
  );
}
