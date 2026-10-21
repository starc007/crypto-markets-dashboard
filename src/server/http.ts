import "server-only";
import type { ApiErrorBody, ApiErrorCode } from "@/shared/market";
import { MarketDataUnavailableError } from "./errors";

/*
 * Responses are cheap to produce from memory, and their `generatedAt` must be
 * accurate for clients to compute data age, so shared caches must not hold them.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonResponse(body: unknown, init: { status?: number; headers?: HeadersInit } = {}) {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { ...NO_STORE, ...Object.fromEntries(new Headers(init.headers)) },
  });
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  retryAfterSeconds?: number,
) {
  const body: ApiErrorBody = { error: { code, message, retryAfterSeconds } };
  const headers: Record<string, string> = {};
  if (retryAfterSeconds !== undefined) headers["Retry-After"] = String(retryAfterSeconds);
  return jsonResponse(body, { status, headers });
}

const UNAVAILABLE_MESSAGES: Record<MarketDataUnavailableError["code"], string> = {
  RATE_LIMITED: "Our market data provider is rate limiting requests.",
  UNAUTHORIZED: "The market data provider rejected our credentials.",
  UNAVAILABLE: "Our market data provider is not responding.",
  TIMEOUT: "Our market data provider is not responding.",
  INVALID_RESPONSE: "Our market data provider returned data we could not verify.",
};

/** Maps failures to responses without leaking upstream details or credentials. */
export function handleRouteError(error: unknown, now = Date.now()): Response {
  if (error instanceof MarketDataUnavailableError) {
    const retryAfterSeconds = Math.max(1, Math.ceil((error.retryAt - now) / 1000));
    return errorResponse(503, error.code, UNAVAILABLE_MESSAGES[error.code], retryAfterSeconds);
  }
  console.error("[api] Unexpected error", error);
  return errorResponse(500, "INTERNAL", "Something went wrong.");
}
