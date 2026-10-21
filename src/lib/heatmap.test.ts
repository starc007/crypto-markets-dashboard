import { makeDisplayCoin } from "@/test/factories";
import { contrastRatio } from "./color";
import { heatColor, layoutHeatmap } from "./heatmap";

describe("layoutHeatmap", () => {
  const groups = {
    A: [
      makeDisplayCoin({ id: "big", marketCap: 750, category: "A" }),
      makeDisplayCoin({ id: "small", marketCap: 250, category: "A" }),
    ],
    B: [makeDisplayCoin({ id: "unknown", marketCap: null, category: "B" })],
    C: [],
  };

  it("sizes tiles by market cap and keeps them inside the canvas", () => {
    const { tiles } = layoutHeatmap(groups, 800, 400);
    const area = (id: string) => {
      const t = tiles.find((tile) => tile.coin.id === id)!;
      return t.width * t.height;
    };
    expect(area("big") / area("small")).toBeCloseTo(3, 0);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(800);
      expect(t.y + t.height).toBeLessThanOrEqual(400);
    }
  });

  it("reports assets it can't size instead of drawing them at zero", () => {
    const layout = layoutHeatmap(groups, 800, 400);
    expect(layout.excluded.map((c) => c.id)).toEqual(["unknown"]);
    expect(layout.categories.map((c) => c.id)).toEqual(["A"]);
  });
});

describe("heatColor", () => {
  it("is neutral for changes that round to zero or are unknown", () => {
    expect(heatColor(-0.004)).toEqual(heatColor(0));
    expect(heatColor(null)).toEqual(heatColor(0));
  });

  it("keeps tile text readable at every intensity", () => {
    for (const pct of [-20, -8, -3, -0.5, 0.5, 3, 8, 20]) {
      const { background, text } = heatColor(pct);
      expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
