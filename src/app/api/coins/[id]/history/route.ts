import { connection } from "next/server";
import { errorResponse, handleRouteError, jsonResponse } from "@/server/http";
import { getCoinHistory } from "@/server/markets";
import { isValidCoinId } from "@/shared/coin-id";

/** Hourly history for one asset in the current snapshot. Unknown ids never reach CoinGecko. */
export async function GET(_request: Request, ctx: RouteContext<"/api/coins/[id]/history">) {
  await connection();
  const { id } = await ctx.params;
  if (!isValidCoinId(id)) return errorResponse(400, "BAD_REQUEST", "Invalid asset id.");

  try {
    const history = await getCoinHistory(id);
    if (!history) {
      return errorResponse(404, "NOT_FOUND", "This asset is not in the current top 50.");
    }
    return jsonResponse(history);
  } catch (error) {
    return handleRouteError(error);
  }
}
