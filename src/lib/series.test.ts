import { downsample } from "./series";

describe("downsample", () => {
  it("keeps the first and last points so the trend's direction is exact", () => {
    const hourly = Array.from({ length: 168 }, (_, i) => i);
    const trend = downsample(hourly, 42);
    expect(trend).toHaveLength(42);
    expect(trend[0]).toBe(0);
    expect(trend.at(-1)).toBe(167);
  });

  it("returns short series unchanged", () => {
    expect(downsample([3, 1, 2], 42)).toEqual([3, 1, 2]);
  });
});
