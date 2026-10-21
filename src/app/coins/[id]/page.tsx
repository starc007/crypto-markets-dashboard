import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CoinDetail, CoinDetailSkeleton } from "@/components/coin/coin-detail";
import { PageShell } from "@/components/page-shell";
import {
  MarketDataUnavailableError,
  getCoinHistory,
  getCoinName,
  getMarkets,
} from "@/server/markets";
import { getPreferredCurrency } from "@/server/preferences";
import { isValidCoinId } from "@/shared/coin-id";

/** Titles pages by asset name; ids outside the top 50 are kept out of search indexes. */
export async function generateMetadata({ params }: PageProps<"/coins/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    const name = isValidCoinId(id) ? await getCoinName(id) : null;
    return name ? { title: name } : { title: "Not found", robots: { index: false } };
  } catch (error) {
    // During an outage we can't tell, so keep the default title rather than hide a real asset.
    if (error instanceof MarketDataUnavailableError) return {};
    throw error;
  }
}

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
