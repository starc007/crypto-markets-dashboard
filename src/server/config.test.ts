import { DEMO_MONTHLY_QUOTA, projectedMonthlyCalls } from "./config";

describe("projectedMonthlyCalls", () => {
  it("keeps the default 5-minute refresh, plus 2-hourly rates, inside the Demo quota", () => {
    // 31 × 24 × 12 = 8,928 market calls + 31 × 12 = 372 rate calls.
    expect(projectedMonthlyCalls(300_000)).toBe(9_300);
    expect(projectedMonthlyCalls(300_000)).toBeLessThan(DEMO_MONTHLY_QUOTA);
  });

  it("flags intervals that would exhaust the quota", () => {
    expect(projectedMonthlyCalls(60_000)).toBe(44_640 + 372);
    expect(projectedMonthlyCalls(240_000)).toBeGreaterThan(DEMO_MONTHLY_QUOTA);
  });
});
