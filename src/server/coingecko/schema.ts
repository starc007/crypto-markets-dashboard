import { z } from "zod";
import type { FxSnapshot } from "@/shared/currency";
import type { MarketQuote } from "@/shared/market";

/**
 * CoinGecko returns null for unknown values and occasionally omits fields. A
 * malformed field becomes null (rendered as "not available") instead of
 * rejecting the whole asset; only a missing identity rejects a row.
 */
const nullableNumber = z.number().nullable().catch(null);
const nonNegativeNumber = z.number().nonnegative().nullable().catch(null);

const coinSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  image: z
    .url({ protocol: /^https$/ })
    .nullable()
    .catch(null),
  market_cap_rank: z.number().int().positive().nullable().catch(null),
  current_price: nonNegativeNumber,
  price_change_percentage_24h: nullableNumber,
  total_volume: nonNegativeNumber,
  market_cap: nonNegativeNumber,
  high_24h: nonNegativeNumber,
  low_24h: nonNegativeNumber,
  circulating_supply: nonNegativeNumber,
  last_updated: z.iso.datetime({ offset: true }).nullable().catch(null),
  sparkline_in_7d: z
    .object({ price: z.array(z.unknown()) })
    .nullable()
    .catch(null),
});

export type CoinGeckoMarketCoin = z.infer<typeof coinSchema>;

export interface ParsedMarkets {
  quotes: MarketQuote[];
  sparklines: Map<string, number[]>;
  rejectedRows: number;
}

/** Returns null when the payload is not an array at all (e.g. an error object). */
export function parseMarkets(payload: unknown): ParsedMarkets | null {
  if (!Array.isArray(payload)) return null;

  const quotes: MarketQuote[] = [];
  const sparklines = new Map<string, number[]>();
  const seen = new Set<string>();
  let rejectedRows = 0;

  for (const row of payload) {
    const result = coinSchema.safeParse(row);
    if (!result.success || seen.has(result.data.id)) {
      rejectedRows++;
      continue;
    }
    const coin = result.data;
    seen.add(coin.id);
    quotes.push(toQuote(coin));

    const prices = coin.sparkline_in_7d?.price.filter(
      (p): p is number => typeof p === "number" && Number.isFinite(p) && p >= 0,
    );
    if (prices && prices.length >= 2) sparklines.set(coin.id, prices);
  }

  return { quotes, sparklines, rejectedRows };
}

function toQuote(coin: CoinGeckoMarketCoin): MarketQuote {
  return {
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    imageUrl: coin.image,
    rank: coin.market_cap_rank,
    priceUsd: coin.current_price,
    change24hPct: coin.price_change_percentage_24h,
    volume24hUsd: coin.total_volume,
    marketCapUsd: coin.market_cap,
    high24hUsd: coin.high_24h,
    low24hUsd: coin.low_24h,
    circulatingSupply: coin.circulating_supply,
    lastUpdated: coin.last_updated,
  };
}

const positiveNumber = z.number().positive();

const fxSchema = z.object({
  bitcoin: z.object({
    usd: positiveNumber,
    eur: positiveNumber,
    gbp: positiveNumber,
    usd_24h_change: nullableNumber,
    eur_24h_change: nullableNumber,
    gbp_24h_change: nullableNumber,
  }),
});

export type FxRates = Omit<FxSnapshot, "fetchedAt">;

/**
 * Derives USD→EUR/GBP rates from Bitcoin's price in each currency, which is
 * how CoinGecko itself converts between currencies. Comparing Bitcoin's 24h
 * change in each currency gives the exchange rate's own 24h change:
 *   rateChange = (1 + btcChangeInEur) / (1 + btcChangeInUsd) − 1
 */
export function parseFxRates(payload: unknown): FxRates | null {
  const result = fxSchema.safeParse(payload);
  if (!result.success) return null;
  const btc = result.data.bitcoin;

  const rateChange = (changeInCurrency: number | null): number | null =>
    changeInCurrency === null || btc.usd_24h_change === null
      ? null
      : ((1 + changeInCurrency / 100) / (1 + btc.usd_24h_change / 100) - 1) * 100;

  return {
    rates: {
      EUR: { perUsd: btc.eur / btc.usd, rateChange24hPct: rateChange(btc.eur_24h_change) },
      GBP: { perUsd: btc.gbp / btc.usd, rateChange24hPct: rateChange(btc.gbp_24h_change) },
    },
  };
}
