import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CoinDetail, CoinDetailSkeleton } from "@/components/coin/coin-detail";
import { PageShell } from "@/components/page-shell";
import { MarketDataUnavailableError, getCoinHistory, getMarkets } from "@/server/markets";
import { getPreferredCurrency } from "@/server/preferences";
import { isValidCoinId } from "@/shared/coin-id";

export default function CoinPage({ params }: PageProps<"/coins/[id]">) {
  return (
    <PageShell>
      <Suspense fallback={<CoinDetailSkeleton />}>
        <InitialCoin params={params} />
      </Suspense>
    </PageShell>
  );
}

async function InitialCoin({ params }: Pick<PageProps<"/coins/[id]">, "params">) {
  await connection();
  const { id } = await params;
  if (!isValidCoinId(id)) notFound();
  const initialCurrency = await getPreferredCurrency();

  let initialMarkets = null;
  let initialHistory = null;
  try {
    // Both come from the same snapshot, so the first paint is consistent.
    [initialMarkets, initialHistory] = await Promise.all([getMarkets(), getCoinHistory(id)]);
    if (!initialHistory) notFound();
  } catch (error) {
    if (!(error instanceof MarketDataUnavailableError)) throw error;
  }
  return (
    <CoinDetail
      id={id}
      initialMarkets={initialMarkets}
      initialHistory={initialHistory}
      initialCurrency={initialCurrency}
    />
  );
}
