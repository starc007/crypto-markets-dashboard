"use client";

import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useFreshness, type ConnectionState } from "@/hooks/use-freshness";
import { historyQuery, useMarkets } from "@/hooks/use-market-data";
import { useWatchlist } from "@/hooks/use-watchlist";
import type { Received } from "@/lib/api-client";
import { alignPerformance } from "@/lib/performance";
import { searchAssets } from "@/lib/search";
import { MAX_COMPARED } from "@/shared/compare";
import type { CoinHistoryResponse, MarketCoin, MarketsResponse } from "@/shared/market";
import { FreshnessBanner, FreshnessIndicator } from "../freshness/freshness";
import { AssetAvatar } from "../ui/asset-avatar";
import { ErrorState } from "../ui/error-state";
import { SearchIcon } from "../ui/icons";
import { CompareChart, type CompareSeries } from "./compare-chart";

const DEFAULT_COUNT = 3;
/** A full 7-day hourly series has 168 points, so it spans 167 hourly steps. */
const FULL_WEEK_HOURS = 7 * 24 - 1;

type HistoryResult = UseQueryResult<Received<CoinHistoryResponse>>;

/** Folds the per-asset history queries into one state. Module-level, so TanStack can memoise it. */
function combineHistories(results: HistoryResult[]) {
  return {
    data: results.every((r) => r.data) ? results.map((r): CoinHistoryResponse => r.data!) : null,
    // With previous data kept as a placeholder, only a failure with nothing to show counts.
    isError: results.some((r) => r.isError && !r.data),
    refetch: () => results.forEach((r) => void r.refetch()),
  };
}

function describeSpan(hours: number): string {
  return hours >= FULL_WEEK_HOURS
    ? "the last 7 days"
    : `the last ${(hours / 24).toFixed(1)} days, the shortest history among these assets`;
}

/**
 * Compares up to five assets' 7-day performance. The selection lives in the
 * URL (`/compare?ids=bitcoin,ethereum`), so a comparison can be shared. Prices
 * come from the same polled snapshot as every other page, and hourly histories
 * are keyed to that snapshot, so comparing costs no upstream quota.
 */
export function CompareView({
  initialIds,
  initialMarkets,
}: {
  initialIds: string[];
  initialMarkets: MarketsResponse | null;
}) {
  const router = useRouter();
  const markets = useMarkets(initialMarkets);
  const { data, isError, error, refetch, isRefetching, fetchStatus } = markets;
  const { watchlist } = useWatchlist();
  const [chosen, setChosen] = useState<string[] | null>(initialIds.length ? initialIds : null);

  const byId = useMemo(() => new Map((data?.coins ?? []).map((coin) => [coin.id, coin])), [data]);

  // Until the user picks, start from their watchlist, or the largest assets.
  const ids = useMemo(() => {
    if (chosen) return chosen.filter((id) => byId.has(id) || !data);
    const watched = [...watchlist].filter((id) => byId.has(id));
    if (watched.length >= 2) return watched.slice(0, DEFAULT_COUNT);
    return [...(data?.coins ?? [])]
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
      .slice(0, DEFAULT_COUNT)
      .map((coin) => coin.id);
  }, [chosen, watchlist, byId, data]);

  function update(next: string[]) {
    setChosen(next);
    router.replace(next.length ? `/compare?ids=${next.join(",")}` : "/compare", { scroll: false });
  }

  const fetchedAt = data?.meta.fetchedAt;
  const histories = useQueries({
    queries: ids.map((id) => historyQuery(id, fetchedAt)),
    combine: combineHistories,
  });

  const compared = useMemo(() => {
    if (!histories.data || fetchedAt === undefined) return null;
    const withHistory = histories.data
      .filter((h): h is CoinHistoryResponse & { prices: number[] } => h.prices !== null)
      .map((h) => ({ prices: h.prices, coin: byId.get(h.id) }))
      .filter((h): h is { prices: number[]; coin: MarketCoin } => h.coin !== undefined);
    const { series, spanHours } = alignPerformance(withHistory.map((h) => h.prices));
    const lines: CompareSeries[] = withHistory.map(({ coin }, i) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      color: coin.accent,
      values: series[i] ?? [],
    }));
    const missing = histories.data.length - withHistory.length;
    return { lines, spanHours, missing, endTime: Date.parse(fetchedAt) };
  }, [histories.data, byId, fetchedAt]);

  if (!data) {
    return isError ? (
      <ErrorState error={error} onRetry={() => refetch()} retrying={isRefetching} />
    ) : (
      <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-surface-muted" />
    );
  }

  const selected = ids.map((id) => byId.get(id)).filter((c): c is MarketCoin => !!c);

  return (
    <CompareContent
      data={data}
      connection={{ error: isError ? error : null, offline: fetchStatus === "paused" }}
      selected={selected}
      ids={ids}
      onChange={update}
      chart={
        selected.length < 2 ? (
          <p className="py-16 text-center text-sm text-muted">
            Add at least two assets to compare their performance.
          </p>
        ) : histories.isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted">
            <p>We couldn&apos;t load price history for these assets.</p>
            <button
              type="button"
              onClick={histories.refetch}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-fg shadow-card transition-colors hover:bg-surface-muted"
            >
              Try again
            </button>
          </div>
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
              Compared over {describeSpan(compared.spanHours)}. Performance is measured in USD.
              {compared.missing > 0 &&
                ` ${compared.missing} ${compared.missing === 1 ? "asset has" : "assets have"} no history and ${compared.missing === 1 ? "is" : "are"} left out.`}
            </p>
          </>
        )
      }
    />
  );
}

function CompareContent({
  data,
  connection,
  selected,
  ids,
  onChange,
  chart,
}: {
  data: Received<MarketsResponse>;
  connection: ConnectionState;
  selected: MarketCoin[];
  ids: string[];
  onChange: (ids: string[]) => void;
  chart: ReactNode;
}) {
  const freshness = useFreshness(data.meta, data.receivedAt, connection);

  return (
    <div className="flex flex-col gap-4">
      <FreshnessIndicator state={freshness} />
      <FreshnessBanner state={freshness} />
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
                onClick={() => onChange(ids.filter((id) => id !== coin.id))}
                className="inline-flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-fg"
              >
                ×
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <AssetPicker
          coins={data.coins}
          exclude={ids}
          disabled={ids.length >= MAX_COMPARED}
          onPick={(id) => onChange([...ids, id])}
        />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
        {chart}
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
