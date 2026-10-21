"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, fetchFromApi, type Received } from "@/lib/api-client";
import type { CoinDetailResponse, MarketsResponse } from "@/shared/market";

/**
 * Clients poll our server, never CoinGecko. Polling more often than the server
 * refreshes is cheap (responses come from memory) and means a new snapshot
 * reaches users within 30s of the server receiving it.
 */
export const POLL_INTERVAL_MS = 30_000;

const pollingOptions = {
  refetchInterval: POLL_INTERVAL_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  staleTime: POLL_INTERVAL_MS / 2,
  // One quick retry for blips; the next poll is the real retry. Client errors won't fix themselves.
  retry: (failureCount: number, error: Error) =>
    failureCount < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
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

export function useMarkets(initialData: MarketsResponse | null) {
  return useQuery({
    queryKey: ["markets"],
    queryFn: ({ signal }) => fetchFromApi<MarketsResponse>("/api/markets", signal),
    initialData: useReceivedInitialData(initialData),
    ...pollingOptions,
  });
}

export function useCoinDetail(id: string, initialData: CoinDetailResponse | null) {
  return useQuery({
    queryKey: ["coin", id],
    queryFn: ({ signal }) =>
      fetchFromApi<CoinDetailResponse>(`/api/coins/${encodeURIComponent(id)}`, signal),
    initialData: useReceivedInitialData(initialData),
    ...pollingOptions,
  });
}
