import { deriveAccent } from "@/lib/color";
import type { MarketCoin, MarketsResponse, SnapshotMeta } from "@/shared/market";

export function makeCoin(overrides: Partial<MarketCoin> & Pick<MarketCoin, "id">): MarketCoin {
  return {
    symbol: overrides.id.slice(0, 3).toUpperCase(),
    name: overrides.id.charAt(0).toUpperCase() + overrides.id.slice(1),
    imageUrl: null,
    rank: 1,
    priceUsd: 1,
    change24hPct: 0,
    volume24hUsd: 1_000,
    marketCapUsd: 1_000_000,
    high24hUsd: 1,
    low24hUsd: 1,
    circulatingSupply: 1_000_000,
    lastUpdated: "2026-01-01T12:00:00.000Z",
    category: "A",
    accent: deriveAccent("#3366FF"),
    hasCuratedMetadata: true,
    ...overrides,
  };
}

export function makeMeta(overrides: Partial<SnapshotMeta> = {}): SnapshotMeta {
  return {
    fetchedAt: "2026-01-01T12:00:00.000Z",
    generatedAt: "2026-01-01T12:00:10.000Z",
    refreshIntervalMs: 300_000,
    lastRefreshFailure: null,
    ...overrides,
  };
}

export function makeMarketsResponse(
  coins: MarketCoin[],
  meta?: Partial<SnapshotMeta>,
): MarketsResponse {
  return { coins, meta: makeMeta(meta) };
}
