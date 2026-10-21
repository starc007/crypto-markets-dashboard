import "server-only";
import { STALE_AFTER_INTERVALS } from "@/shared/freshness-policy";
import type { FxSnapshot } from "@/shared/currency";
import type {
  CoinHistoryResponse,
  MarketsResponse,
  RefreshFailure,
  SnapshotMeta,
} from "@/shared/market";
import { CacheEmptyError, createSwrCache, type CacheRead, type SwrCache } from "./cache/swr-cache";
import { MarketDataUnavailableError } from "./errors";
import { fetchFxRates, fetchTopMarkets } from "./coingecko/client";
import { UpstreamError, toUpstreamError } from "./coingecko/errors";
import type { FxRates, ParsedMarkets } from "./coingecko/schema";
import { FX_REFRESH_INTERVAL_MS, getServerConfig } from "./config";
import { enrichQuote } from "./enrich";

export interface MarketsSource {
  markets: SwrCache<ParsedMarkets, UpstreamError>;
  fx: SwrCache<FxRates, UpstreamError>;
  refreshIntervalMs: number;
  now: () => number;
}

const FIRST_RETRY_MS = 15_000;

/**
 * Exponential backoff (15s, 30s, 60s, …) capped at the cache's own refresh
 * interval, so a long failure never calls upstream more often than normal
 * operation would. That matters for the quota: a 200 response whose body
 * fails validation is still a billed call. Retry-After wins when it asks for
 * longer, and a rejected key won't fix itself, so it goes straight to the cap.
 */
export function backoff(capMs: number) {
  return (error: UpstreamError, consecutiveFailures: number): number => {
    if (error.code === "UNAUTHORIZED") return capMs;
    const delay = Math.min(capMs, FIRST_RETRY_MS * 2 ** (consecutiveFailures - 1));
    return Math.max(delay, error.options.retryAfterMs ?? 0);
  };
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
    // Matches the age at which the UI calls data stale.
    maxStaleMs: options.refreshIntervalMs * STALE_AFTER_INTERVALS,
    retryDelayMs: backoff(options.refreshIntervalMs),
    toError: logAndConvert("markets"),
    now: options.now,
  });

  const fx = createSwrCache({
    fetcher: () => fetchFxRates(options.apiKey),
    ttlMs: FX_REFRESH_INTERVAL_MS,
    retryDelayMs: backoff(FX_REFRESH_INTERVAL_MS),
    toError: logAndConvert("fx"),
    now: options.now,
  });

  return {
    markets,
    fx,
    refreshIntervalMs: options.refreshIntervalMs,
    now: options.now ?? Date.now,
  };
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

/** How much longer than the markets read a request may wait for rates before answering USD-only. */
const FX_GRACE_MS = 300;

/**
 * Rates older than this are withheld: converting with day-old rates under an
 * "up to date" badge would mislead, so EUR/GBP fall back to USD with a notice.
 */
export const FX_MAX_AGE_MS = 3 * FX_REFRESH_INTERVAL_MS;

/**
 * Rates are optional: missing, slow or outdated rates must never take prices
 * down with them. The wait is tied to the markets read rather than a fixed
 * timer, so a cold start doesn't answer USD-only while markets is still
 * loading anyway. A cold fetch still completes in the background.
 */
async function readFx(
  source: MarketsSource,
  marketsRead: Promise<unknown>,
): Promise<FxSnapshot | null> {
  const read = source.fx.get().then(
    (r): FxSnapshot | null =>
      source.now() - r.fetchedAt > FX_MAX_AGE_MS
        ? null
        : { ...r.value, fetchedAt: new Date(r.fetchedAt).toISOString() },
    (error: unknown) => {
      if (error instanceof CacheEmptyError) return null;
      throw error;
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = marketsRead.then(
    () =>
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), FX_GRACE_MS);
      }),
    () => null, // A markets failure is reported by readMarkets.
  );
  try {
    return await Promise.race([read, budget]);
  } finally {
    clearTimeout(timer);
  }
}

async function readMarkets(source: MarketsSource) {
  try {
    return await source.markets.get();
  } catch (error) {
    if (error instanceof CacheEmptyError) {
      const { failure } = error as CacheEmptyError<UpstreamError>;
      throw new MarketDataUnavailableError(failure.error.code, failure.retryAt);
    }
    throw error;
  }
}

async function readSnapshot(): Promise<Snapshot & { generatedAt: number }> {
  const source = getMarketsSource();
  const marketsRead = readMarkets(source);
  const [markets, fx] = await Promise.all([marketsRead, readFx(source, marketsRead)]);
  // Stamped after any waiting, so the reported age is never understated.
  return { markets, fx, refreshIntervalMs: source.refreshIntervalMs, generatedAt: source.now() };
}

function toMeta(snapshot: Snapshot & { generatedAt: number }): SnapshotMeta {
  const { markets } = snapshot;
  const failure: RefreshFailure | null = markets.failure && {
    code: markets.failure.error.code,
    at: new Date(markets.failure.at).toISOString(),
    retryAt: new Date(markets.failure.retryAt).toISOString(),
  };
  return {
    fetchedAt: new Date(markets.fetchedAt).toISOString(),
    generatedAt: new Date(snapshot.generatedAt).toISOString(),
    refreshIntervalMs: snapshot.refreshIntervalMs,
    lastRefreshFailure: failure,
  };
}

export async function getMarkets(): Promise<MarketsResponse> {
  const snapshot = await readSnapshot();
  return {
    coins: snapshot.markets.value.quotes.map((quote) =>
      enrichQuote(quote, snapshot.markets.value.sparklines.get(quote.id) ?? null),
    ),
    fx: snapshot.fx,
    meta: toMeta(snapshot),
  };
}

/** Returns null for ids outside the current top 50: we only serve what we already hold. */
export async function getCoinHistory(id: string): Promise<CoinHistoryResponse | null> {
  // History needs no exchange rates, so it never waits on them.
  const markets = await readMarkets(getMarketsSource());
  if (!markets.value.quotes.some((q) => q.id === id)) return null;
  return {
    id,
    fetchedAt: new Date(markets.fetchedAt).toISOString(),
    prices: markets.value.sparklines.get(id) ?? null,
  };
}

/** The asset's display name in the current snapshot, or null if it isn't in the top 50. */
export async function getCoinName(id: string): Promise<string | null> {
  const markets = await readMarkets(getMarketsSource());
  return markets.value.quotes.find((q) => q.id === id)?.name ?? null;
}
