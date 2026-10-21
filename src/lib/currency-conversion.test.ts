import { makeCoin, makeFx } from "@/test/factories";
import { createConverter, toDisplayCoin } from "./currency-conversion";

describe("createConverter", () => {
  const fx = makeFx({
    rates: {
      EUR: { perUsd: 0.9, rateChange24hPct: 0.5 },
      GBP: { perUsd: 0.8, rateChange24hPct: null },
    },
  });

  it("leaves USD untouched and needs no rates", () => {
    const usd = createConverter("USD", null)!;
    expect(usd.amount(83_321)).toBe(83_321);
    expect(usd.change(-1.3)).toBe(-1.3);
  });

  it("scales amounts by the rate, keeping missing values missing", () => {
    const eur = createConverter("EUR", fx)!;
    expect(eur.amount(100)).toBeCloseTo(90, 12);
    expect(eur.amount(5.16e-6)).toBeCloseTo(4.644e-6, 18);
    expect(eur.amount(null)).toBeNull();
  });

  it("restates a 24h change in the target currency", () => {
    const eur = createConverter("EUR", fx)!;
    // A stablecoin flat in USD rises in EUR when the dollar strengthens.
    expect(eur.change(0)).toBeCloseTo(0.5, 12);
    expect(eur.change(2)).toBeCloseTo((1.02 * 1.005 - 1) * 100, 12);
    expect(eur.change(null)).toBeNull();
  });

  it("refuses to guess a change when the rate's own change is unknown", () => {
    expect(createConverter("GBP", fx)!.change(2)).toBeNull();
  });

  it("returns null when rates are missing or invalid", () => {
    expect(createConverter("EUR", null)).toBeNull();
    const broken = makeFx({
      rates: { EUR: { perUsd: 0, rateChange24hPct: 0 }, GBP: { perUsd: 0.8, rateChange24hPct: 0 } },
    });
    expect(createConverter("EUR", broken)).toBeNull();
  });
});

describe("toDisplayCoin", () => {
  it("converts every monetary field and keeps identity fields", () => {
    const coin = makeCoin({
      id: "bitcoin",
      priceUsd: 100,
      volume24hUsd: 1_000,
      marketCapUsd: 10_000,
      high24hUsd: 110,
      low24hUsd: 90,
      change24hPct: 0,
      circulatingSupply: 21,
    });
    const display = toDisplayCoin(coin, createConverter("GBP", makeFx())!);

    expect(display).toMatchObject({ id: "bitcoin", circulatingSupply: 21 });
    expect(display.price).toBeCloseTo(80, 12);
    expect(display.volume24h).toBeCloseTo(800, 12);
    expect(display.marketCap).toBeCloseTo(8_000, 12);
    expect(display.high24h).toBeCloseTo(88, 12);
    expect(display.low24h).toBeCloseTo(72, 12);
    expect(display.change24hPct).toBeCloseTo(-0.25, 12);
  });
});
