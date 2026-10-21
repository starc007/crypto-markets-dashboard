import { keepNewestSnapshot, reconcileHistory } from "./snapshot-order";

const snapshot = (fetchedAt: string, price: number) => ({
  coins: [{ id: "bitcoin", price }],
  meta: { fetchedAt },
});

describe("keepNewestSnapshot", () => {
  it("ignores a response carrying an older snapshot than the one on screen", () => {
    const shown = snapshot("2026-01-01T12:05:00Z", 84_000);
    const late = snapshot("2026-01-01T12:00:00Z", 83_000);
    expect(keepNewestSnapshot(shown, late)).toBe(shown);
  });

  it("accepts newer snapshots, reusing unchanged parts", () => {
    const shown = snapshot("2026-01-01T12:00:00Z", 83_000);
    const next = snapshot("2026-01-01T12:05:00Z", 83_000);
    const result = keepNewestSnapshot(shown, next) as typeof shown;
    expect(result.meta.fetchedAt).toBe("2026-01-01T12:05:00Z");
    expect(result.coins).toBe(shown.coins);
  });
});

describe("reconcileHistory", () => {
  it("refetches whichever side is behind", () => {
    expect(reconcileHistory("2026-01-01T12:00:00Z", "2026-01-01T12:00:00Z")).toBe("in-sync");
    expect(reconcileHistory("2026-01-01T12:00:00Z", "2026-01-01T12:05:00Z")).toBe(
      "refetch-history",
    );
    expect(reconcileHistory("2026-01-01T12:05:00Z", "2026-01-01T12:00:00Z")).toBe(
      "refetch-markets",
    );
  });
});
