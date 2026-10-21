import "server-only";
import type { FxSnapshot } from "@/shared/currency";
import type {
  CoinDetailResponse,
  MarketsResponse,
  RefreshFailure,
  SnapshotMeta,
} from "@/shared/market";
import { CacheEmptyError, createSwrCache, type CacheRead, type SwrCache } from "./cache/swr-cache";
import { fetchFxRates, fetchTopMarkets } from "./coingecko/client";
import { UpstreamError, toUpstreamError } from "./coingecko/errors";
import type { FxRates, ParsedMarkets } from "./coingecko/schema";
import { FX_REFRESH_INTERVAL_MS, getServerConfig } from "./config";
import { enrichQuote } from "./enrich";

export interface MarketsSource {
  markets: SwrCache<ParsedMarkets, UpstreamError>;
  fx: SwrCache<FxRates, UpstreamError>;
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

function logAndConvert(label: string) {
  return (thrown: unknown) => {
    const error = toUpstreamError(thrown);
    console.error(`[${label}] Refresh failed (${error.code}): ${error.message}`);
    return error;
  };
}

export function createMarketsSource(options: {
  apiKey: string | undefined;
  refreshIntervalMs: number;
  now?: () => number;
}): MarketsSource {
  const markets = createSwrCache({
    fetcher: async () => {
      const parsed = await fetchTopMarkets(options.apiKey);
      if (parsed.rejectedRows > 0) {
        console.warn(`[markets] Dropped ${parsed.rejectedRows} malformed rows from CoinGecko.`);
      }
      return parsed;
    },
    ttlMs: options.refreshIntervalMs,
    retryDelayMs,
    toError: logAndConvert("markets"),
    now: options.now,
  });

  const fx = createSwrCache({
    fetcher: () => fetchFxRates(options.apiKey),
    ttlMs: FX_REFRESH_INTERVAL_MS,
    retryDelayMs,
    toError: logAndConvert("fx"),
    now: options.now,
  });

  return { markets, fx, refreshIntervalMs: options.refreshIntervalMs };
}

/*
 * Route handlers and server components can be bundled separately, so a plain
 * module-level variable may exist more than once per process. Pinning the
 * source on globalThis guarantees one shared set of caches (and in-flight
 * requests) per server process, which is what the quota calculation relies on.
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

interface Snapshot {
  markets: CacheRead<ParsedMarkets, UpstreamError>;
  /** Null when rates have never loaded; the UI then offers USD only. */
  fx: FxSnapshot | null;
  refreshIntervalMs: number;
}

/** How long a request may wait for rates on a cold start before answering USD-only. */
const FX_WAIT_BUDGET_MS = 1_500;

/**
 * Rates are optional: missing or slow rates must never take prices down with
 * them. A cold fetch still completes in the background for later requests.
 */
async function readFx(source: MarketsSource): Promise<FxSnapshot | null> {
  const read = source.fx.get().then(
    (r): FxSnapshot => ({ ...r.value, fetchedAt: new Date(r.fetchedAt).toISOString() }),
    (error: unknown) => {
      if (error instanceof CacheEmptyError) return null;
      throw error;
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), FX_WAIT_BUDGET_MS);
  });
  try {
    return await Promise.race([read, budget]);
  } finally {
    clearTimeout(timer);
  }
}

async function readSnapshot(): Promise<Snapshot> {
  const source = getMarketsSource();
  try {
    const [markets, fx] = await Promise.all([source.markets.get(), readFx(source)]);
    return { markets, fx, refreshIntervalMs: source.refreshIntervalMs };
  } catch (error) {
    if (error instanceof CacheEmptyError) {
      const { failure } = error as CacheEmptyError<UpstreamError>;
      throw new MarketDataUnavailableError(failure.error.code, failure.retryAt);
    }
    throw error;
  }
}

function toMeta(snapshot: Snapshot, now: number): SnapshotMeta {
  const { markets } = snapshot;
  const failure: RefreshFailure | null = markets.failure && {
    code: markets.failure.error.code,
    at: new Date(markets.failure.at).toISOString(),
    retryAt: new Date(markets.failure.retryAt).toISOString(),
  };
  return {
    fetchedAt: new Date(markets.fetchedAt).toISOString(),
    generatedAt: new Date(now).toISOString(),
    refreshIntervalMs: snapshot.refreshIntervalMs,
    lastRefreshFailure: failure,
  };
}

export async function getMarkets(now = Date.now()): Promise<MarketsResponse> {
  const snapshot = await readSnapshot();
  return {
    coins: snapshot.markets.value.quotes.map(enrichQuote),
    fx: snapshot.fx,
    meta: toMeta(snapshot, now),
  };
}

/** Returns null for ids outside the current top 50: we only serve what we already hold. */
export async function getCoinDetail(
  id: string,
  now = Date.now(),
): Promise<CoinDetailResponse | null> {
  const snapshot = await readSnapshot();
  const quote = snapshot.markets.value.quotes.find((q) => q.id === id);
  if (!quote) return null;
  return {
    coin: enrichQuote(quote),
    sparkline7d: snapshot.markets.value.sparklines.get(id) ?? null,
    fx: snapshot.fx,
    meta: toMeta(snapshot, now),
  };
}
