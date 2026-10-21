"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, fetchFromApi, type Received } from "@/lib/api-client";
import { isHistoryResponse, isMarketsResponse } from "@/lib/api-guards";
import { keepNewestSnapshot, reconcileHistory } from "@/lib/snapshot-order";
import type { CoinHistoryResponse, MarketsResponse } from "@/shared/market";

/**
 * Clients poll our server, never CoinGecko. Polling more often than the server
 * refreshes is cheap (responses come from memory) and means a new snapshot
 * reaches users within 30s of the server receiving it.
 */
export const POLL_INTERVAL_MS = 30_000;

const marketsQuery = {
  queryKey: ["markets"],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchFromApi("/api/markets", isMarketsResponse, signal),
  // Never let a response from an older snapshot replace a newer one on screen.
  structuralSharing: keepNewestSnapshot,
} as const;

/**
 * Server-rendered data is stamped with the moment it reaches this client, so
 * age calculations start from hydration rather than from the server's clock.
 */
function useReceivedInitialData<T>(initialData: T | null): Received<T> | undefined {
  const [received] = useState(() =>
    initialData ? { ...initialData, receivedAt: Date.now() } : undefined,
  );
  return received;
}

/**
 * The single source of prices for every view. The dashboard, asset pages,
 * compare and the command palette all read this one query, so an asset can
 * never show two different prices at once.
 */
export function useMarkets(initialData: MarketsResponse | null) {
  return useQuery({
    ...marketsQuery,
    initialData: useReceivedInitialData(initialData),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: POLL_INTERVAL_MS / 2,
    // One quick retry for blips; the next poll is the real retry. Client errors won't fix themselves.
    retry: (failureCount: number, error: Error) =>
      failureCount < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
  });
}

/** The shared markets snapshot without polling, for the palette and compare page. */
export function useMarketsSnapshot(enabled = true) {
  return useQuery({ ...marketsQuery, enabled, staleTime: POLL_INTERVAL_MS });
}

/**
 * History for one asset, keyed by asset only so the query (and the chart on
 * screen) survives snapshot changes. `useHistorySync` keeps it matched to the
 * markets snapshot.
 */
export function historyQuery(id: string, enabled = true) {
  return {
    queryKey: ["history", id],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchFromApi(`/api/coins/${encodeURIComponent(id)}/history`, isHistoryResponse, signal),
    enabled,
    staleTime: Infinity,
    retry: 1,
  };
}

/**
 * Keeps histories on the same snapshot as the markets data on screen:
 * history from an older snapshot is refetched, and history from a newer one
 * means markets is behind, so markets is refetched instead.
 */
export function useHistorySync(
  histories: readonly { fetchedAt: string | undefined; refetch: () => unknown }[],
  marketsFetchedAt: string | undefined,
) {
  const queryClient = useQueryClient();
  const signature = histories.map((h) => h.fetchedAt ?? "").join("|");

  useEffect(() => {
    if (!marketsFetchedAt) return;
    let marketsBehind = false;
    for (const history of histories) {
      if (!history.fetchedAt) continue;
      const sync = reconcileHistory(history.fetchedAt, marketsFetchedAt);
      if (sync === "refetch-history") void history.refetch();
      if (sync === "refetch-markets") marketsBehind = true;
    }
    if (marketsBehind) void queryClient.invalidateQueries({ queryKey: marketsQuery.queryKey });
    // `signature` captures the histories' snapshots; the array itself is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, marketsFetchedAt, queryClient]);
}

export function useCoinHistory(
  id: string,
  marketsFetchedAt: string | undefined,
  initialData: CoinHistoryResponse | null,
) {
  const history = useQuery({
    ...historyQuery(id, marketsFetchedAt !== undefined),
    initialData: useReceivedInitialData(initialData),
  });
  useHistorySync(
    [{ fetchedAt: history.data?.fetchedAt, refetch: history.refetch }],
    marketsFetchedAt,
  );
  return history;
}
