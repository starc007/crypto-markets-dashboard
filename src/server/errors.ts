import "server-only";
import type { UpstreamErrorCode } from "@/shared/market";

/** Thrown when there is no market data to serve at all (cold start during an outage). */
export class MarketDataUnavailableError extends Error {
  constructor(
    readonly code: UpstreamErrorCode,
    readonly retryAt: number,
  ) {
    super("Market data is unavailable");
    this.name = "MarketDataUnavailableError";
  }
}
