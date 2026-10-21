import "server-only";
import { cookies } from "next/headers";
import { CURRENCY_COOKIE, isCurrency, type Currency } from "@/shared/currency";

/** The viewer's saved currency, so the first render already uses it. */
export async function getPreferredCurrency(): Promise<Currency> {
  const value = (await cookies()).get(CURRENCY_COOKIE)?.value;
  return isCurrency(value) ? value : "USD";
}
