export const CURRENCIES = ["USD", "EUR", "GBP"] as const;

export type Currency = (typeof CURRENCIES)[number];
export type ForeignCurrency = Exclude<Currency, "USD">;

export const FOREIGN_CURRENCIES: readonly ForeignCurrency[] = ["EUR", "GBP"];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export interface FxRate {
  /** Units of this currency per 1 USD, e.g. 0.89 for EUR. */
  perUsd: number;
  /**
   * 24h change of `perUsd`, in percent. Needed to restate a USD 24h change in
   * this currency: (1 + changeUsd) × (1 + rateChange) − 1. Null when unknown.
   */
  rateChange24hPct: number | null;
}

export interface FxSnapshot {
  rates: Record<ForeignCurrency, FxRate>;
  /** When the server received these rates from CoinGecko (ISO 8601). */
  fetchedAt: string;
}

/** Name of the cookie that remembers the viewer's currency, so the server renders it directly. */
export const CURRENCY_COOKIE = "currency";
