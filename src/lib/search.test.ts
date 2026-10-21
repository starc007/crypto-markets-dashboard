import { alignPerformance } from "./performance";
import { searchAssets } from "./search";

const assets = [
  { id: "ethereum", name: "Ethereum", symbol: "ETH", rank: 2 },
  { id: "tether", name: "Tether", symbol: "USDT", rank: 3 },
  { id: "ethena", name: "Ethena", symbol: "ENA", rank: 41 },
  { id: "shiba-inu", name: "Shiba Inu", symbol: "SHIB", rank: 36 },
];
const ids = (list: { id: string }[]) => list.map((a) => a.id);

describe("searchAssets", () => {
  it("ranks an exact ticker first, then prefixes, then substrings", () => {
    expect(ids(searchAssets(assets, "eth"))).toEqual(["ethereum", "ethena", "tether"]);
  });

  it("matches any word of a name", () => {
    expect(ids(searchAssets(assets, "inu"))).toEqual(["shiba-inu"]);
  });

  it("lists the largest assets for an empty query", () => {
    expect(ids(searchAssets(assets, "  ", 2))).toEqual(["ethereum", "tether"]);
  });
});

describe("alignPerformance", () => {
  it("right-aligns to the shortest history and rebases each series to 0%", () => {
    const { series, spanHours } = alignPerformance([
      [50, 100, 110, 121],
      [200, 180],
    ]);
    expect(spanHours).toBe(1);
    expect(series[0]![0]).toBe(0);
    expect(series[0]![1]).toBeCloseTo(10, 10); // 110 → 121
    expect(series[1]![1]).toBeCloseTo(-10, 10); // 200 → 180
  });

  it("refuses to compare when any series is too short to draw", () => {
    expect(alignPerformance([[1, 2], [3]])).toEqual({ series: [], spanHours: 0 });
  });
});
