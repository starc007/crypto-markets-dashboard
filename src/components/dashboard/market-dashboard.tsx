"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useCurrencyPreference, useDisplayCurrency } from "@/hooks/use-currency";
import { useMarkets } from "@/hooks/use-market-data";
import { useWatchlist } from "@/hooks/use-watchlist";
import {
  DEFAULT_SORT,
  INITIAL_DIRECTION,
  filterCoins,
  groupByCategory,
  sortCoins,
  summarizeCategory,
  type SortKey,
  type SortState,
} from "@/lib/market-view";
import { toDisplayCoin } from "@/lib/currency-conversion";
import { CATEGORIES, CATEGORY_IDS } from "@/shared/categories";
import type { Currency } from "@/shared/currency";
import type { MarketsResponse } from "@/shared/market";
import { ConversionNote, CurrencySwitcher } from "../currency/currency-switcher";
import { FreshnessBanner, FreshnessIndicator, useFreshness } from "../freshness/freshness";
import { ErrorState } from "../ui/error-state";
import { CategorySection } from "./category-section";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { MarketTable } from "./market-table";
import { Toolbar, type CategoryFilter } from "./toolbar";

interface MarketDashboardProps {
  initialData: MarketsResponse | null;
  initialCurrency: Currency;
}

export function MarketDashboard({ initialData, initialCurrency }: MarketDashboardProps) {
  const { data, error, isError, refetch, isRefetching } = useMarkets(initialData);

  if (!data) {
    return isError ? (
      <ErrorState error={error} onRetry={() => refetch()} retrying={isRefetching} />
    ) : (
      <DashboardSkeleton />
    );
  }
  return (
    <MarketsView
      data={data}
      initialCurrency={initialCurrency}
      clientError={isError ? error : null}
    />
  );
}

function MarketsView({
  data,
  initialCurrency,
  clientError,
}: {
  data: MarketsResponse & { receivedAt: number };
  initialCurrency: Currency;
  clientError: Error | null;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const { watchlist, toggle } = useWatchlist();
  const freshness = useFreshness(data.meta, data.receivedAt, clientError);
  const { currency: requestedCurrency, setCurrency } = useCurrencyPreference(initialCurrency);
  const display = useDisplayCurrency(requestedCurrency, data.fx);
  const { currency } = display.converter;

  // Convert first, so sorting, filtering and category totals all use displayed values.
  const coins = useMemo(
    () => data.coins.map((coin) => toDisplayCoin(coin, display.converter)),
    [data.coins, display.converter],
  );
  const groups = useMemo(() => groupByCategory(coins), [coins]);
  const visibleGroups = useMemo(
    () =>
      groupByCategory(
        sortCoins(filterCoins(coins, { query, category, watchlistOnly, watchlist }), sort),
      ),
    [coins, query, category, watchlistOnly, watchlist, sort],
  );
  const visibleCount = CATEGORY_IDS.reduce((n, id) => n + visibleGroups[id].length, 0);
  const isFiltered = query.trim() !== "" || category !== "all" || watchlistOnly;

  function handleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: INITIAL_DIRECTION[key] },
    );
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setWatchlistOnly(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FreshnessIndicator state={freshness} />
        <CurrencySwitcher value={currency} onChange={setCurrency} fx={data.fx} />
      </div>
      <FreshnessBanner state={freshness} />
      <ConversionNote display={display} fx={data.fx} />

      <Toolbar
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        watchlistOnly={watchlistOnly}
        onWatchlistOnlyChange={setWatchlistOnly}
        watchlistCount={watchlist.size}
        sort={sort}
        onSortChange={setSort}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {isFiltered ? `Showing ${visibleCount} of ${data.coins.length} assets` : ""}
      </p>

      {visibleCount === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center"
        >
          <p className="font-medium">
            {watchlistOnly && watchlist.size === 0
              ? "Your watchlist is empty."
              : "No assets match your filters."}
          </p>
          <p className="mt-1 text-sm text-muted">
            {watchlistOnly && watchlist.size === 0
              ? "Star an asset to add it to your watchlist."
              : "Try a different name or symbol."}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm shadow-card transition-colors hover:bg-surface-muted"
          >
            Clear filters
          </button>
        </motion.div>
      ) : (
        <AnimatePresence initial={false}>
          {CATEGORY_IDS.filter((id) => visibleGroups[id].length > 0).map((id, index) => (
            <CategorySection
              key={id}
              index={index}
              category={CATEGORIES[id]}
              summary={summarizeCategory(groups[id])}
              currency={currency}
              visibleCount={visibleGroups[id].length}
            >
              {(headingId) => (
                <MarketTable
                  coins={visibleGroups[id]}
                  currency={currency}
                  labelledBy={headingId}
                  sort={sort}
                  onSort={handleSort}
                  fetchedAt={data.meta.fetchedAt}
                  isStale={freshness.freshness === "stale"}
                  watchlist={watchlist}
                  onToggleWatch={toggle}
                />
              )}
            </CategorySection>
          ))}
        </AnimatePresence>
      )}
      <p className="text-xs text-muted">Market data from CoinGecko.</p>
    </div>
  );
}
