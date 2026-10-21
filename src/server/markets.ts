import "server-only";
import type {
  CoinDetailResponse,
  MarketsResponse,
  RefreshFailure,
  SnapshotMeta,
} from "@/shared/market";
import { CacheEmptyError, createSwrCache, type CacheRead, type SwrCache } from "./cache/swr-cache";
import { fetchTopMarkets } from "./coingecko/client";
import { UpstreamError, toUpstreamError } from "./coingecko/errors";
import type { ParsedMarkets } from "./coingecko/schema";
import { getServerConfig } from "./config";
import { enrichQuote } from "./enrich";

type MarketsCache = SwrCache<ParsedMarkets, UpstreamError>;

export interface MarketsSource {
  cache: MarketsCache;
  refreshIntervalMs: number;
}

const FIRST_RETRY_MS = 15_000;
const MAX_RETRY_MS = 5 * 60_000;

/**
 * Exponential backoff (15s, 30s, 60s, …) capped at 5 minutes, which also caps
 * upstream calls during a long outage at the same rate as normal operation.
 * Retry-After from CoinGecko always wins when it asks for longer. A rejected
 * key will not fix itself, so it goes straight to the cap.
 */
export function retryDelayMs(error: UpstreamError, consecutiveFailures: number): number {
  if (error.code === "UNAUTHORIZED") return MAX_RETRY_MS;
  const backoff = Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** (consecutiveFailures - 1));
  return Math.max(backoff, error.options.retryAfterMs ?? 0);
}

export class MarketDataUnavailableError extends Error {
  constructor(
    readonly code: UpstreamError["code"],
    readonly retryAt: number,
  ) {
    super("Market data is unavailable");
    this.name = "MarketDataUnavailableError";
  }
}

export function createMarketsSource(options: {
  apiKey: string | undefined;
  refreshIntervalMs: number;
  now?: () => number;
}): MarketsSource {
  const cache = createSwrCache({
    fetcher: async () => {
      const parsed = await fetchTopMarkets(options.apiKey);
      if (parsed.rejectedRows > 0) {
        console.warn(`[markets] Dropped ${parsed.rejectedRows} malformed rows from CoinGecko.`);
      }
      return parsed;
    },
    ttlMs: options.refreshIntervalMs,
    retryDelayMs,
    toError: (thrown) => {
      const error = toUpstreamError(thrown);
      console.error(`[markets] Refresh failed (${error.code}): ${error.message}`);
      return error;
    },
    now: options.now,
  });
  return { cache, refreshIntervalMs: options.refreshIntervalMs };
}

/*
 * Route handlers and server components can be bundled separately, so a plain
 * module-level variable may exist more than once per process. Pinning the cache
 * on globalThis guarantees a single shared cache (and in-flight request) per
 * server process, which is what the quota calculation relies on.
 */
const globalStore = globalThis as typeof globalThis & { __marketsSource?: MarketsSource };

function getMarketsSource(): MarketsSource {
  globalStore.__marketsSource ??= createMarketsSource(getServerConfig());
  return globalStore.__marketsSource;
}

/** Test hook: install a source with a controlled clock and config. */
export function setMarketsSourceForTesting(source: MarketsSource | undefined): void {
  globalStore.__marketsSource = source;
}

type SnapshotRead = CacheRead<ParsedMarkets, UpstreamError> & { refreshIntervalMs: number };

async function readSnapshot(): Promise<SnapshotRead> {
  const source = getMarketsSource();
  try {
    return { ...(await source.cache.get()), refreshIntervalMs: source.refreshIntervalMs };
  } catch (error) {
    if (error instanceof CacheEmptyError) {
      const { failure } = error as CacheEmptyError<UpstreamError>;
      throw new MarketDataUnavailableError(failure.error.code, failure.retryAt);
    }
    throw error;
  }
}

function toMeta(read: SnapshotRead, now: number): SnapshotMeta {
  const failure: RefreshFailure | null = read.failure && {
    code: read.failure.error.code,
    at: new Date(read.failure.at).toISOString(),
    retryAt: new Date(read.failure.retryAt).toISOString(),
  };
  return {
    fetchedAt: new Date(read.fetchedAt).toISOString(),
    generatedAt: new Date(now).toISOString(),
    refreshIntervalMs: read.refreshIntervalMs,
    lastRefreshFailure: failure,
  };
}

export async function getMarkets(now = Date.now()): Promise<MarketsResponse> {
  const read = await readSnapshot();
  return { coins: read.value.quotes.map(enrichQuote), meta: toMeta(read, now) };
}

/** Returns null for ids outside the current top 50: we only serve what we already hold. */
export async function getCoinDetail(
  id: string,
  now = Date.now(),
): Promise<CoinDetailResponse | null> {
  const read = await readSnapshot();
  const quote = read.value.quotes.find((q) => q.id === id);
  if (!quote) return null;
  return {
    coin: enrichQuote(quote),
    sparkline7d: read.value.sparklines.get(id) ?? null,
    meta: toMeta(read, now),
  };
}
