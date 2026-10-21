import type { UpstreamErrorCode } from "@/shared/market";

export class UpstreamError extends Error {
  constructor(
    readonly code: UpstreamErrorCode,
    message: string,
    readonly options: { status?: number; retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "UpstreamError";
  }
}

export function toUpstreamError(thrown: unknown): UpstreamError {
  if (thrown instanceof UpstreamError) return thrown;
  if (thrown instanceof DOMException && thrown.name === "TimeoutError") {
    return new UpstreamError("TIMEOUT", "CoinGecko did not respond in time", { cause: thrown });
  }
  return new UpstreamError("UNAVAILABLE", "Could not reach CoinGecko", { cause: thrown });
}

/** Parses a Retry-After header (delta-seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}
