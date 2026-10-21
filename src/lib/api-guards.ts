import type { CoinHistoryResponse, MarketsResponse } from "@/shared/market";

/*
 * Minimal shape checks for our own API's responses. Not full validation, which
 * the server already does against CoinGecko: they stop a 200 with some other
 * body (a captive portal, a proxy error page) from replacing good data on
 * screen and crashing the view. A failed check is a query error, so the
 * previous data stays visible.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isMarketsResponse(body: unknown): body is MarketsResponse {
  return (
    isObject(body) &&
    Array.isArray(body.coins) &&
    isObject(body.meta) &&
    typeof body.meta.fetchedAt === "string" &&
    typeof body.meta.generatedAt === "string"
  );
}

export function isHistoryResponse(body: unknown): body is CoinHistoryResponse {
  return (
    isObject(body) &&
    typeof body.id === "string" &&
    typeof body.fetchedAt === "string" &&
    (body.prices === null || Array.isArray(body.prices))
  );
}
