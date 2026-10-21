import { makeDisplayCoin as makeCoin } from "@/test/factories";
import { filterCoins, groupByCategory, sortCoins, summarizeCategory } from "./market-view";

const btc = makeCoin({
  id: "bitcoin",
  name: "Bitcoin",
  symbol: "BTC",
  rank: 1,
  price: 83_000,
  change24hPct: 2,
  marketCap: 1_600,
  category: "A",
});
const eth = makeCoin({
  id: "ethereum",
  name: "Ethereum",
  symbol: "ETH",
  rank: 2,
  price: 2_400,
  change24hPct: -1,
  marketCap: 300,
  category: "A",
});
const usdt = makeCoin({
  id: "tether",
  name: "Tether",
  symbol: "USDT",
  rank: 3,
  price: 1,
  change24hPct: null,
  marketCap: 180,
  category: "B",
});
const shib = makeCoin({
  id: "shiba-inu",
  name: "Shiba Inu",
  symbol: "SHIB",
  rank: 36,
  price: 0.000005,
  change24hPct: 4,
  marketCap: null,
  category: "C",
});
const all = [shib, usdt, eth, btc];

const ids = (coins: { id: string }[]) => coins.map((c) => c.id);

describe("sortCoins", () => {
  it("sorts by market cap descending, keeping missing values last", () => {
    expect(ids(sortCoins(all, { key: "marketCap", direction: "desc" }))).toEqual([
      "bitcoin",
      "ethereum",
      "tether",
      "shiba-inu",
    ]);
  });

  it("keeps missing values last in ascending order too", () => {
    expect(ids(sortCoins(all, { key: "change24h", direction: "asc" }))).toEqual([
      "ethereum",
      "bitcoin",
      "shiba-inu",
      "tether",
    ]);
  });

  it("sorts tiny prices numerically, not lexically", () => {
    expect(ids(sortCoins(all, { key: "price", direction: "asc" }))).toEqual([
      "shiba-inu",
      "tether",
      "ethereum",
      "bitcoin",
    ]);
  });

  it("sorts names alphabetically and breaks ties by rank", () => {
    const a = makeCoin({ id: "a", name: "Same", rank: 9 });
    const b = makeCoin({ id: "b", name: "same", rank: 4 });
    expect(ids(sortCoins([a, b], { key: "name", direction: "asc" }))).toEqual(["b", "a"]);
  });

  it("does not mutate its input", () => {
    const input = [...all];
    sortCoins(input, { key: "price", direction: "asc" });
    expect(input).toEqual(all);
  });
});

describe("filterCoins", () => {
  const base = {
    query: "",
    category: "all" as const,
    watchlistOnly: false,
    watchlist: new Set<string>(),
  };

  it("matches name or symbol, ignoring case and surrounding spaces", () => {
    expect(ids(filterCoins(all, { ...base, query: "  BITC " }))).toEqual(["bitcoin"]);
    expect(ids(filterCoins(all, { ...base, query: "eth" }))).toEqual(["tether", "ethereum"]);
    expect(ids(filterCoins(all, { ...base, query: "usdt" }))).toEqual(["tether"]);
  });

  it("filters by category and watchlist", () => {
    expect(ids(filterCoins(all, { ...base, category: "A" }))).toEqual(["ethereum", "bitcoin"]);
    expect(
      ids(filterCoins(all, { ...base, watchlistOnly: true, watchlist: new Set(["tether"]) })),
    ).toEqual(["tether"]);
  });
});

describe("groupByCategory", () => {
  it("always returns all three groups, preserving order", () => {
    const groups = groupByCategory([btc, eth]);
    expect(ids(groups.A)).toEqual(["bitcoin", "ethereum"]);
    expect(groups.B).toEqual([]);
    expect(groups.C).toEqual([]);
  });
});

describe("summarizeCategory", () => {
  it("computes the change in combined value, not the average of percentages", () => {
    // Before: 100 + 100 = 200. After: +100% → 200, −50% → 50. Combined: 250 (+25%).
    const up = makeCoin({ id: "up", marketCap: 200, change24hPct: 100 });
    const down = makeCoin({ id: "down", marketCap: 50, change24hPct: -50 });
    const summary = summarizeCategory([up, down]);
    expect(summary.totalMarketCap).toBe(250);
    expect(summary.change24hPct).toBeCloseTo(25, 10);
  });

  it("leaves assets with missing values out of the totals", () => {
    const summary = summarizeCategory([btc, usdt, shib]);
    expect(summary.count).toBe(3);
    expect(summary.totalMarketCap).toBe(1_780);
    expect(summary.change24hPct).toBeCloseTo(2, 10);
  });

  it("returns nulls rather than zeros when nothing is known", () => {
    expect(summarizeCategory([shib])).toMatchObject({
      totalMarketCap: null,
      change24hPct: null,
    });
    expect(summarizeCategory([])).toMatchObject({
      count: 0,
      totalMarketCap: null,
      change24hPct: null,
    });
  });
});
