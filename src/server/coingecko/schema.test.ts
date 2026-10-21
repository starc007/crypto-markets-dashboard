import fixture from "@/test/fixtures/coingecko-markets.json";
import { parseFxRates, parseMarkets } from "./schema";

const row = (overrides: Record<string, unknown> = {}) => ({ ...fixture[0], ...overrides });

describe("parseMarkets", () => {
  it("parses a real CoinGecko response", () => {
    const parsed = parseMarkets(fixture)!;
    expect(parsed.quotes).toHaveLength(50);
    expect(parsed.rejectedRows).toBe(0);
    expect(parsed.quotes[0]).toMatchObject({ id: "bitcoin", symbol: "BTC", rank: 1 });
  });

  it("keeps very small prices exact", () => {
    const shib = parseMarkets(fixture)!.quotes.find((q) => q.id === "shiba-inu")!;
    expect(shib.priceUsd).toBe(5.16e-6);
  });

  it("turns null, missing or malformed numbers into null rather than 0", () => {
    const { quotes } = parseMarkets([
      row({
        current_price: null,
        total_volume: "1000",
        market_cap: -5,
        price_change_percentage_24h: undefined,
        high_24h: Number.NaN,
      }),
    ])!;
    expect(quotes[0]).toMatchObject({
      priceUsd: null,
      volume24hUsd: null,
      marketCapUsd: null,
      change24hPct: null,
      high24hUsd: null,
    });
  });

  it("rejects rows without an identity and duplicate ids", () => {
    const parsed = parseMarkets([row(), row(), row({ id: "" }), { name: "nameless" }, "junk"])!;
    expect(parsed.quotes).toHaveLength(1);
    expect(parsed.rejectedRows).toBe(4);
  });

  it("drops non-https logo URLs", () => {
    expect(parseMarkets([row({ image: "javascript:alert(1)" })])!.quotes[0]!.imageUrl).toBeNull();
    expect(parseMarkets([row({ image: "http://x.test/a.png" })])!.quotes[0]!.imageUrl).toBeNull();
  });

  it("keeps sparklines that have enough valid points, filtering bad ones", () => {
    const parsed = parseMarkets([
      row({ id: "ok", sparkline_in_7d: { price: [1, null, 2, "x", 3] } }),
      row({ id: "short", sparkline_in_7d: { price: [1] } }),
      row({ id: "none", sparkline_in_7d: null }),
    ])!;
    expect(parsed.sparklines.get("ok")).toEqual([1, 2, 3]);
    expect(parsed.sparklines.has("short")).toBe(false);
    expect(parsed.sparklines.has("none")).toBe(false);
  });

  it("returns null for payloads that are not a list of coins", () => {
    expect(parseMarkets({ status: { error_code: 429 } })).toBeNull();
    expect(parseMarkets(null)).toBeNull();
  });
});

describe("parseFxRates", () => {
  it("derives USD rates and their 24h change from Bitcoin's prices", () => {
    const fx = parseFxRates({
      bitcoin: {
        usd: 83336.19243672618,
        eur: 74211.21270967441,
        gbp: 62219.30129041438,
        usd_24h_change: 2.3037862945381167,
        eur_24h_change: 2.1058817910531733,
        gbp_24h_change: 1.9116221671586737,
      },
    })!;
    expect(fx.rates.EUR.perUsd).toBeCloseTo(0.8905, 5);
    expect(fx.rates.GBP.perUsd).toBeCloseTo(0.74661, 5);
    expect(fx.rates.EUR.rateChange24hPct).toBeCloseTo(-0.19345, 4);
  });

  it("keeps rates but drops the change when a 24h change is missing", () => {
    const fx = parseFxRates({
      bitcoin: {
        usd: 100,
        eur: 90,
        gbp: 80,
        usd_24h_change: null,
        eur_24h_change: 1,
        gbp_24h_change: 1,
      },
    })!;
    expect(fx.rates.EUR).toEqual({ perUsd: 0.9, rateChange24hPct: null });
  });

  it("rejects missing or non-positive prices", () => {
    expect(parseFxRates({ bitcoin: { usd: 100, eur: 0, gbp: 80 } })).toBeNull();
    expect(parseFxRates({ ethereum: {} })).toBeNull();
    expect(parseFxRates(null)).toBeNull();
  });
});
