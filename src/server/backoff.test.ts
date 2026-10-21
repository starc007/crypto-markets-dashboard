import { UpstreamError } from "./coingecko/errors";
import { backoff } from "./markets";

const FIVE_MIN = 5 * 60_000;
const TWO_HOURS = 2 * 60 * 60_000;
const failure = (code: UpstreamError["code"], retryAfterMs?: number) =>
  new UpstreamError(code, "failed", { retryAfterMs });

describe("backoff", () => {
  it("doubles from 15 s and stops at the cache's own interval", () => {
    const delay = backoff(FIVE_MIN);
    expect([1, 2, 3, 4, 5, 6].map((n) => delay(failure("UNAVAILABLE"), n))).toEqual([
      15_000,
      30_000,
      60_000,
      120_000,
      240_000,
      FIVE_MIN,
    ]);
    // FX refreshes every 2 h, so a long FX failure must not retry every 5 min.
    expect(backoff(TWO_HOURS)(failure("INVALID_RESPONSE"), 20)).toBe(TWO_HOURS);
  });

  it("waits longer when Retry-After asks for it", () => {
    expect(backoff(FIVE_MIN)(failure("RATE_LIMITED", 600_000), 1)).toBe(600_000);
  });

  it("goes straight to the cap for a rejected key", () => {
    expect(backoff(FIVE_MIN)(failure("UNAUTHORIZED"), 1)).toBe(FIVE_MIN);
  });
});
