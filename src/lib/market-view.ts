import { CATEGORY_IDS, type CategoryId } from "@/shared/categories";
import type { DisplayCoin } from "./currency-conversion";

export type SortKey = "marketCap" | "price" | "change24h" | "volume" | "name";
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { key: "marketCap", direction: "desc" };

/** The direction a column sorts in when first selected. */
export const INITIAL_DIRECTION: Record<SortKey, SortDirection> = {
  marketCap: "desc",
  price: "desc",
  change24h: "desc",
  volume: "desc",
  name: "asc",
};

const sortValue: Record<Exclude<SortKey, "name">, (coin: DisplayCoin) => number | null> = {
  marketCap: (c) => c.marketCap,
  price: (c) => c.price,
  change24h: (c) => c.change24hPct,
  volume: (c) => c.volume24h,
};

function byRank(a: DisplayCoin, b: DisplayCoin): number {
  return (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
}

/**
 * Sorts without mutating. Missing values always sort last in either direction,
 * so "highest change first" never starts with assets we know nothing about.
 * Ties fall back to market-cap rank to keep the order stable between refreshes.
 */
export function sortCoins(coins: readonly DisplayCoin[], sort: SortState): DisplayCoin[] {
  const factor = sort.direction === "asc" ? 1 : -1;

  return [...coins].sort((a, b) => {
    if (sort.key === "name") {
      return factor * a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || byRank(a, b);
    }
    const va = sortValue[sort.key](a);
    const vb = sortValue[sort.key](b);
    if (va === null && vb === null) return byRank(a, b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return factor * (va - vb) || byRank(a, b);
  });
}

export interface CoinFilter {
  query: string;
  category: CategoryId | "all";
  watchlistOnly: boolean;
  watchlist: ReadonlySet<string>;
}

export function filterCoins(coins: readonly DisplayCoin[], filter: CoinFilter): DisplayCoin[] {
  const query = filter.query.trim().toLowerCase();
  return coins.filter(
    (coin) =>
      (filter.category === "all" || coin.category === filter.category) &&
      (!filter.watchlistOnly || filter.watchlist.has(coin.id)) &&
      (query === "" ||
        coin.name.toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query)),
  );
}

export function groupByCategory(coins: readonly DisplayCoin[]): Record<CategoryId, DisplayCoin[]> {
  const groups = Object.fromEntries(CATEGORY_IDS.map((id) => [id, [] as DisplayCoin[]])) as Record<
    CategoryId,
    DisplayCoin[]
  >;
  for (const coin of coins) groups[coin.category].push(coin);
  return groups;
}

export interface CategorySummary {
  count: number;
  /** Sum of known market caps; null when no asset in the group reports one. */
  totalMarketCap: number | null;
  /**
   * 24h change of the group's combined value, derived from each asset's price
   * change: Σ cap / Σ (cap / (1 + change)) − 1. Averaging percentages, even
   * weighted, is not the same number. Assumes supply was constant over 24h.
   */
  change24hPct: number | null;
  /** Assets left out of the totals because a value was missing. */
  excludedCount: number;
}

export function summarizeCategory(coins: readonly DisplayCoin[]): CategorySummary {
  let totalNow = 0;
  let totalBefore = 0;
  let included = 0;
  let capSum = 0;
  let capCount = 0;

  for (const coin of coins) {
    const cap = coin.marketCap;
    if (cap === null) continue;
    capSum += cap;
    capCount++;
    const change = coin.change24hPct;
    // A change of -100% or worse has no meaningful "before" value.
    if (change === null || change <= -100) continue;
    totalNow += cap;
    totalBefore += cap / (1 + change / 100);
    included++;
  }

  return {
    count: coins.length,
    totalMarketCap: capCount > 0 ? capSum : null,
    change24hPct: included > 0 && totalBefore > 0 ? (totalNow / totalBefore - 1) * 100 : null,
    excludedCount: coins.length - included,
  };
}
