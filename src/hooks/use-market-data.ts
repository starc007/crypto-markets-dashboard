"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, fetchFromApi, type Received } from "@/lib/api-client";
import { keepNewestSnapshot } from "@/lib/snapshot-order";
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
    fetchFromApi<MarketsResponse>("/api/markets", signal),
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

export function historyQuery(id: string, fetchedAt: string | undefined) {
  return {
    // Keyed by snapshot: a new snapshot fetches matching history, and history never mixes snapshots.
    queryKey: ["history", id, fetchedAt],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchFromApi<CoinHistoryResponse>(`/api/coins/${encodeURIComponent(id)}/history`, signal),
    enabled: fetchedAt !== undefined,
    staleTime: Infinity,
    retry: 1,
    // Keep showing the previous chart while the next snapshot's history loads.
    placeholderData: keepPreviousData,
  };
}

export function useCoinHistory(
  id: string,
  fetchedAt: string | undefined,
  initialData: CoinHistoryResponse | null,
) {
  const initial = useReceivedInitialData(initialData);
  return useQuery({
    ...historyQuery(id, fetchedAt),
    initialData: initial?.fetchedAt === fetchedAt ? initial : undefined,
  });
}
