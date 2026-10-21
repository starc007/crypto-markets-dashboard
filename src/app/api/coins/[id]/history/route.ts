import { connection } from "next/server";
import { errorResponse, handleRouteError, jsonResponse } from "@/server/http";
import { getCoinDetail } from "@/server/markets";
import { isValidCoinId } from "@/shared/coin-id";

/** Detail for one asset in the current snapshot. Unknown ids never reach CoinGecko. */
export async function GET(_request: Request, ctx: RouteContext<"/api/coins/[id]">) {
  await connection();
  const { id } = await ctx.params;
  if (!isValidCoinId(id)) return errorResponse(400, "BAD_REQUEST", "Invalid asset id.");

  try {
    const detail = await getCoinDetail(id);
    if (!detail) {
      return errorResponse(404, "NOT_FOUND", "This asset is not in the current top 50.");
    }
    return jsonResponse(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
