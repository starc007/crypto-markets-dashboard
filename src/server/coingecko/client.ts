import "server-only";
import { UpstreamError, parseRetryAfter } from "./errors";
import { parseFxRates, parseMarkets, type FxRates, type ParsedMarkets } from "./schema";

export const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
export const TOP_N = 50;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The main upstream request. Parameters here and in `buildFxUrl` are fixed
 * server-side: nothing from the incoming request is forwarded, so our API
 * cannot be used as a general-purpose CoinGecko proxy.
 *
 * `sparkline=true` returns 7 days of hourly prices for every asset in the same
 * call, which powers the detail charts without spending extra quota.
 */
export function buildMarketsUrl(): URL {
  const url = new URL(`${COINGECKO_BASE_URL}/coins/markets`);
  url.search = new URLSearchParams({
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: String(TOP_N),
    page: "1",
    sparkline: "true",
    price_change_percentage: "24h",
    precision: "full",
  }).toString();
  return url;
}

/**
 * Bitcoin's price in each supported currency, plus 24h changes. From this we
 * derive exchange rates and how they moved (see `parseFxRates`). One small
 * call serves every currency, instead of one /coins/markets call per currency.
 */
export function buildFxUrl(): URL {
  const url = new URL(`${COINGECKO_BASE_URL}/simple/price`);
  url.search = new URLSearchParams({
    ids: "bitcoin",
    vs_currencies: "usd,eur,gbp",
    include_24hr_change: "true",
    precision: "full",
  }).toString();
  return url;
}

async function getJson(url: URL, apiKey: string | undefined): Promise<unknown> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  const response = await fetch(url, {
    headers,
    // Our own cache decides freshness; never let the framework layer another one on top.
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) throw errorForStatus(response);

  try {
    return await response.json();
  } catch (cause) {
    throw new UpstreamError("INVALID_RESPONSE", "CoinGecko returned invalid JSON", { cause });
  }
}

/**
 * The share of the top 50 that must arrive with both a price and a market cap.
 * Malformed fields degrade to null one at a time, which is right for a single
 * odd asset but would hide a systemic change (say, prices sent as strings)
 * behind a page of dashes and a "fresh" badge. Below this bar the whole
 * snapshot is rejected, so the last good one stays on screen with a reason.
 */
export const MIN_COMPLETE_SHARE = 0.9;

export async function fetchTopMarkets(apiKey: string | undefined): Promise<ParsedMarkets> {
  const parsed = parseMarkets(await getJson(buildMarketsUrl(), apiKey));
  if (!parsed || parsed.quotes.length === 0) {
    throw new UpstreamError("INVALID_RESPONSE", "CoinGecko returned no usable market data");
  }
  const complete = parsed.quotes.filter((q) => q.priceUsd !== null && q.marketCapUsd !== null);
  if (complete.length < Math.ceil(TOP_N * MIN_COMPLETE_SHARE)) {
    throw new UpstreamError(
      "INVALID_RESPONSE",
      `Only ${complete.length} of ${TOP_N} assets had a price and market cap`,
    );
  }
  return parsed;
}

export async function fetchFxRates(apiKey: string | undefined): Promise<FxRates> {
  const parsed = parseFxRates(await getJson(buildFxUrl(), apiKey));
  if (!parsed) throw new UpstreamError("INVALID_RESPONSE", "CoinGecko returned no usable FX rates");
  return parsed;
}

function errorForStatus(response: Response): UpstreamError {
  const { status } = response;
  if (status === 429) {
    return new UpstreamError("RATE_LIMITED", "CoinGecko rate limit or monthly quota reached", {
      status,
      retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
    });
  }
  if (status === 401 || status === 403) {
    return new UpstreamError("UNAUTHORIZED", "CoinGecko rejected the API key", { status });
  }
  return new UpstreamError("UNAVAILABLE", `CoinGecko responded with HTTP ${status}`, { status });
}
