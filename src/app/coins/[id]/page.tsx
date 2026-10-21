import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CoinDetail, CoinDetailSkeleton } from "@/components/coin/coin-detail";
import { PageShell } from "@/components/page-shell";
import { MarketDataUnavailableError, getCoinDetail } from "@/server/markets";
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

  let initialData = null;
  try {
    initialData = await getCoinDetail(id);
    if (!initialData) notFound();
  } catch (error) {
    if (!(error instanceof MarketDataUnavailableError)) throw error;
  }
  return <CoinDetail id={id} initialData={initialData} initialCurrency={initialCurrency} />;
}
