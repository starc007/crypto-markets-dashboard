import type { SnapshotMeta } from "@/shared/market";
import { classifyFreshness, dataAgeMs, quoteLagMs } from "./freshness";

const MINUTE = 60_000;
const INTERVAL = 5 * MINUTE;

function meta(fetchedAt: string, generatedAt: string): SnapshotMeta {
  return { fetchedAt, generatedAt, refreshIntervalMs: INTERVAL, lastRefreshFailure: null };
}

describe("dataAgeMs", () => {
  it("uses the server's clock for age at response time and the client's for elapsed time", () => {
    const m = meta("2026-01-01T12:00:00.000Z", "2026-01-01T12:02:00.000Z");
    const receivedAt = 1_000_000;
    expect(dataAgeMs(m, receivedAt, receivedAt + 30_000)).toBe(2 * MINUTE + 30_000);
  });

  it("is unaffected by a client clock that is hours off", () => {
    const m = meta("2026-01-01T12:00:00.000Z", "2026-01-01T12:01:00.000Z");
    // Client clock set to 1990: only the local difference matters.
    const receivedAt = Date.parse("1990-06-01T00:00:00Z");
    expect(dataAgeMs(m, receivedAt, receivedAt + 10_000)).toBe(MINUTE + 10_000);
  });

  it("never goes negative", () => {
    const m = meta("2026-01-01T12:00:05.000Z", "2026-01-01T12:00:00.000Z");
    expect(dataAgeMs(m, 100, 50)).toBe(0);
  });
});

describe("classifyFreshness", () => {
  it.each([
    [0, "live"],
    [INTERVAL + 90_000, "live"],
    [INTERVAL + 90_001, "delayed"],
    [3 * INTERVAL, "delayed"],
    [3 * INTERVAL + 1, "stale"],
    [24 * 60 * MINUTE, "stale"],
  ] as const)("classifies an age of %sms as %s", (age, expected) => {
    expect(classifyFreshness(age, INTERVAL)).toBe(expected);
  });
});

describe("quoteLagMs", () => {
  const fetchedAt = "2026-01-01T12:00:00.000Z";

  it("ignores normal update delays", () => {
    expect(quoteLagMs("2026-01-01T11:58:00.000Z", fetchedAt)).toBeNull();
  });

  it("flags assets CoinGecko has not updated for over an hour", () => {
    expect(quoteLagMs("2026-01-01T09:00:00.000Z", fetchedAt)).toBe(3 * 60 * MINUTE);
  });

  it("returns null when the update time is unknown", () => {
    expect(quoteLagMs(null, fetchedAt)).toBeNull();
  });
});
