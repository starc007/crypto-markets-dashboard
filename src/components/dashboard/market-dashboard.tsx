"use client";

import { useMemo, useState } from "react";
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
import { CATEGORIES, CATEGORY_IDS } from "@/shared/categories";
import type { MarketsResponse } from "@/shared/market";
import { FreshnessBanner, FreshnessIndicator, useFreshness } from "../freshness/freshness";
import { ErrorState } from "../ui/error-state";
import { CategorySection } from "./category-section";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { MarketTable } from "./market-table";
import { Toolbar, type CategoryFilter } from "./toolbar";

export function MarketDashboard({ initialData }: { initialData: MarketsResponse | null }) {
  const { data, error, isError, refetch, isRefetching } = useMarkets(initialData);

  if (!data) {
    return isError ? (
      <ErrorState error={error} onRetry={() => refetch()} retrying={isRefetching} />
    ) : (
      <DashboardSkeleton />
    );
  }
  return <MarketsView data={data} clientError={isError ? error : null} />;
}

function MarketsView({
  data,
  clientError,
}: {
  data: MarketsResponse & { receivedAt: number };
  clientError: Error | null;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const { watchlist, toggle } = useWatchlist();
  const freshness = useFreshness(data.meta, data.receivedAt, clientError);

  const groups = useMemo(() => groupByCategory(data.coins), [data.coins]);
  const visibleGroups = useMemo(
    () =>
      groupByCategory(
        sortCoins(filterCoins(data.coins, { query, category, watchlistOnly, watchlist }), sort),
      ),
    [data.coins, query, category, watchlistOnly, watchlist, sort],
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
        <p className="text-xs text-muted">Prices in USD · Data from CoinGecko</p>
      </div>
      <FreshnessBanner state={freshness} />

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
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
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
            className="mt-4 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted"
          >
            Clear filters
          </button>
        </div>
      ) : (
        CATEGORY_IDS.filter((id) => visibleGroups[id].length > 0).map((id) => (
          <CategorySection
            key={id}
            category={CATEGORIES[id]}
            summary={summarizeCategory(groups[id])}
            visibleCount={visibleGroups[id].length}
          >
            {(headingId) => (
              <MarketTable
                coins={visibleGroups[id]}
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
        ))
      )}
    </div>
  );
}
