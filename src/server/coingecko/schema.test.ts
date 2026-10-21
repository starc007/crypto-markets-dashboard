import fixture from "@/test/fixtures/coingecko-markets.json";
import { parseMarkets } from "./schema";

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
