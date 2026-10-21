import { connection } from "next/server";
import { handleRouteError, jsonResponse } from "@/server/http";
import { getMarkets } from "@/server/markets";

/**
 * Serves the shared top-50 snapshot. The request (query string, headers, body)
 * is deliberately ignored: every caller gets the same cached data, and nothing
 * a client sends can change which upstream request is made.
 */
export async function GET() {
  await connection();
  try {
    return jsonResponse(await getMarkets());
  } catch (error) {
    return handleRouteError(error);
  }
}
