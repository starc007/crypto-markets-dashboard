"use client";

import { useQueries } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useMarketsSnapshot } from "@/hooks/use-market-data";
import { useWatchlist } from "@/hooks/use-watchlist";
import { fetchFromApi } from "@/lib/api-client";
import { formatDuration } from "@/lib/format";
import { alignPerformance } from "@/lib/performance";
import { searchAssets } from "@/lib/search";
import type { CoinDetailResponse, MarketCoin } from "@/shared/market";
import { AssetAvatar } from "../ui/asset-avatar";
import { ErrorState } from "../ui/error-state";
import { SearchIcon } from "../ui/icons";
import { CompareChart, type CompareSeries } from "./compare-chart";

export const MAX_COMPARED = 5;
const DEFAULT_COUNT = 3;
const FULL_WEEK_HOURS = 7 * 24 - 1;

/**
 * Compares up to five assets' 7-day performance. The selection lives in the
 * URL (`/compare?ids=bitcoin,ethereum`), so a comparison can be shared. Hourly
 * histories come from the asset endpoints, which serve the cached snapshot:
 * comparing costs no upstream quota.
 */
export function CompareView({ initialIds }: { initialIds: string[] }) {
  const router = useRouter();
  const { data: markets, isError, error, refetch, isRefetching } = useMarketsSnapshot();
  const { watchlist } = useWatchlist();
  const [chosen, setChosen] = useState<string[] | null>(initialIds.length ? initialIds : null);

  const byId = useMemo(
    () => new Map((markets?.coins ?? []).map((coin) => [coin.id, coin])),
    [markets],
  );

  // Until the user picks, start from their watchlist, or the largest assets.
  const ids = useMemo(() => {
    if (chosen) return chosen.filter((id) => byId.has(id) || !markets);
    const watched = [...watchlist].filter((id) => byId.has(id));
    if (watched.length >= 2) return watched.slice(0, DEFAULT_COUNT);
    return [...(markets?.coins ?? [])]
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
      .slice(0, DEFAULT_COUNT)
      .map((coin) => coin.id);
  }, [chosen, watchlist, byId, markets]);

  function update(next: string[]) {
    setChosen(next);
    router.replace(next.length ? `/compare?ids=${next.join(",")}` : "/compare", { scroll: false });
  }

  const details = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["coin", id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchFromApi<CoinDetailResponse>(`/api/coins/${encodeURIComponent(id)}`, signal),
      staleTime: 60_000,
    })),
  });

  const ready = details.every((q) => q.data);
  const compared = useMemo(() => {
    if (!ready) return null;
    const withHistory = details
      .map((q): CoinDetailResponse => q.data!)
      .filter((d): d is CoinDetailResponse & { sparkline7d: number[] } => d.sparkline7d !== null);
    const { series, spanHours } = alignPerformance(withHistory.map((d) => d.sparkline7d));
    const lines: CompareSeries[] = withHistory.map((d, i) => ({
      id: d.coin.id,
      symbol: d.coin.symbol,
      name: d.coin.name,
      color: d.coin.accent.display,
      values: series[i] ?? [],
    }));
    const missing = details.length - withHistory.length;
    return { lines, spanHours, missing, endTime: Date.parse(withHistory[0]?.meta.fetchedAt ?? "") };
  }, [ready, details]);

  if (!markets && isError) {
    return <ErrorState error={error} onRetry={() => refetch()} retrying={isRefetching} />;
  }

  const selected = ids.map((id) => byId.get(id)).filter((c): c is MarketCoin => !!c);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <AnimatePresence initial={false}>
          {selected.map((coin) => (
            <motion.span
              key={coin.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pr-1 pl-1.5 text-sm shadow-card"
            >
              <AssetAvatar
                symbol={coin.symbol}
                imageUrl={coin.imageUrl}
                accent={coin.accent}
                size={20}
              />
              <span className="font-medium">{coin.symbol}</span>
              <button
                type="button"
                aria-label={`Remove ${coin.name}`}
                onClick={() => update(ids.filter((id) => id !== coin.id))}
                className="inline-flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-fg"
              >
                ×
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <AssetPicker
          coins={markets?.coins ?? []}
          exclude={ids}
          disabled={ids.length >= MAX_COMPARED}
          onPick={(id) => update([...ids, id])}
        />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
        {!markets ? (
          <div aria-busy="true" className="h-80 animate-pulse rounded-lg bg-surface-muted" />
        ) : selected.length < 2 ? (
          <p className="py-16 text-center text-sm text-muted">
            Add at least two assets to compare their performance.
          </p>
        ) : !compared ? (
          <div aria-busy="true" className="h-80 animate-pulse rounded-lg bg-surface-muted" />
        ) : compared.lines.length < 2 ? (
          <p className="py-16 text-center text-sm text-muted">
            Not enough price history to compare these assets.
          </p>
        ) : (
          <>
            <CompareChart series={compared.lines} endTime={compared.endTime} />
            <p className="mt-3 text-xs text-muted">
              {compared.spanHours < FULL_WEEK_HOURS
                ? `Compared over the last ${formatDuration(compared.spanHours * 3_600_000)}, the shortest history among these assets. `
                : "Compared over the last 7 days. "}
              Performance is measured in USD.
              {compared.missing > 0 &&
                ` ${compared.missing} asset(s) have no history and are left out.`}
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function AssetPicker({
  coins,
  exclude,
  disabled,
  onPick,
}: {
  coins: readonly MarketCoin[];
  exclude: readonly string[];
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(
    () =>
      searchAssets(
        coins.filter((c) => !exclude.includes(c.id)),
        query,
        6,
      ),
    [coins, exclude, query],
  );
  const index = Math.min(active, Math.max(0, results.length - 1));

  function pick(coin: MarketCoin | undefined) {
    if (!coin) return;
    onPick(coin.id);
    setQuery("");
    setActive(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((index + delta + results.length) % Math.max(1, results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(results[index]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[index] ? `${listId}-${index}` : undefined}
        aria-label="Add an asset to compare"
        placeholder={disabled ? `Up to ${MAX_COMPARED} assets` : "Add asset…"}
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-9 w-48 rounded-full border border-border bg-surface pr-3 pl-9 text-sm shadow-card transition-[border-color,box-shadow] placeholder:text-muted focus:border-focus focus:ring-3 focus:ring-focus/15 focus:outline-none disabled:opacity-60"
      />
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            className="absolute top-full left-0 z-20 mt-1 w-64 rounded-xl border border-border bg-surface p-1 shadow-lg"
          >
            {results.map((coin, i) => (
              <li
                key={coin.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === index}
                // mousedown, not click, so the input's blur doesn't close the list first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(coin);
                }}
                onMouseMove={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  i === index ? "bg-surface-muted" : ""
                }`}
              >
                <AssetAvatar
                  symbol={coin.symbol}
                  imageUrl={coin.imageUrl}
                  accent={coin.accent}
                  size={20}
                />
                <span className="flex-1 truncate">{coin.name}</span>
                <span className="text-xs text-muted">{coin.symbol}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
