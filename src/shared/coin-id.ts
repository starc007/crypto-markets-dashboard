/** CoinGecko ids are lowercase slugs, e.g. "avalanche-2" or "usd-coin". */
const COIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export function isValidCoinId(id: string): boolean {
  return id.length <= 100 && COIN_ID_PATTERN.test(id);
}
