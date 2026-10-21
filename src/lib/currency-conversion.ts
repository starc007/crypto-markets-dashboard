import type { Currency, FxRate, FxSnapshot } from "@/shared/currency";
import type { MarketCoin } from "@/shared/market";

/**
 * Market data arrives in USD; this restates it in the viewer's currency.
 *
 * Amounts scale by the exchange rate. A 24h change cannot simply be reused:
 * if a coin is flat in USD while the dollar fell 0.5% against the euro, the
 * coin fell 0.5% in EUR. So: (1 + changeUsd) × (1 + rateChange) − 1, and the
 * result is null when the rate's own change is unknown.
 */
export interface CurrencyConverter {
  currency: Currency;
  /** The rate used, or null for USD. */
  rate: FxRate | null;
  amount(usd: number | null): number | null;
  change(changeUsdPct: number | null): number | null;
}

const IDENTITY: CurrencyConverter = {
  currency: "USD",
  rate: null,
  amount: (usd) => usd,
  change: (pct) => pct,
};

/** Returns null when rates for `currency` are unavailable. */
export function createConverter(
  currency: Currency,
  fx: FxSnapshot | null,
): CurrencyConverter | null {
  if (currency === "USD") return IDENTITY;
  const rate = fx?.rates[currency];
  if (!rate || !(rate.perUsd > 0)) return null;

  return {
    currency,
    rate,
    amount: (usd) => (usd === null ? null : usd * rate.perUsd),
    change: (pct) =>
      pct === null || rate.rateChange24hPct === null
        ? null
        : ((1 + pct / 100) * (1 + rate.rateChange24hPct / 100) - 1) * 100,
  };
}

/** A coin's values in the display currency. Field names carry no currency on purpose. */
export interface DisplayCoin extends Pick<
  MarketCoin,
  | "id"
  | "symbol"
  | "name"
  | "imageUrl"
  | "rank"
  | "category"
  | "accent"
  | "circulatingSupply"
  | "lastUpdated"
  | "trend7d"
> {
  price: number | null;
  change24hPct: number | null;
  volume24h: number | null;
  marketCap: number | null;
  high24h: number | null;
  low24h: number | null;
}

export function toDisplayCoin(coin: MarketCoin, converter: CurrencyConverter): DisplayCoin {
  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    imageUrl: coin.imageUrl,
    rank: coin.rank,
    category: coin.category,
    accent: coin.accent,
    circulatingSupply: coin.circulatingSupply,
    lastUpdated: coin.lastUpdated,
    // Scaling by a constant rate doesn't change a sparkline's shape, so it stays in USD.
    trend7d: coin.trend7d,
    price: converter.amount(coin.priceUsd),
    change24hPct: converter.change(coin.change24hPct),
    volume24h: converter.amount(coin.volume24hUsd),
    marketCap: converter.amount(coin.marketCapUsd),
    high24h: converter.amount(coin.high24hUsd),
    low24h: converter.amount(coin.low24hUsd),
  };
}
