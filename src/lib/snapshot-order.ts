import { replaceEqualDeep } from "@tanstack/react-query";

interface HasSnapshotTime {
  meta: { fetchedAt: string };
}

function isSnapshot(value: unknown): value is HasSnapshotTime {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as HasSnapshotTime).meta?.fetchedAt === "string"
  );
}

/**
 * Structural-sharing function for snapshot queries. Responses can arrive out
 * of order once a CDN or several server instances sit in between: a slower or
 * cached response may carry an older snapshot than the one on screen.
 * Accepting it would make prices jump backwards in time, so it is ignored.
 * Otherwise this behaves like TanStack's default, keeping unchanged parts
 * referentially equal so unchanged rows don't re-render.
 */
export function keepNewestSnapshot(previous: unknown, next: unknown): unknown {
  if (
    isSnapshot(previous) &&
    isSnapshot(next) &&
    Date.parse(next.meta.fetchedAt) < Date.parse(previous.meta.fetchedAt)
  ) {
    return previous;
  }
  return replaceEqualDeep(previous, next);
}

export type HistorySync = "in-sync" | "refetch-history" | "refetch-markets";

/**
 * What to do when an asset's history and the markets snapshot on screen come
 * from different snapshots. History is fetched separately, so the server can
 * refresh in between: older history is refetched; newer history means the
 * client's markets data is behind, so that is refetched instead.
 */
export function reconcileHistory(historyFetchedAt: string, marketsFetchedAt: string): HistorySync {
  const history = Date.parse(historyFetchedAt);
  const markets = Date.parse(marketsFetchedAt);
  if (history === markets) return "in-sync";
  return history < markets ? "refetch-history" : "refetch-markets";
}
