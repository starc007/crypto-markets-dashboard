import { connection } from "next/server";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { MarketDashboard } from "@/components/dashboard/market-dashboard";
import { PageShell } from "@/components/page-shell";
import { MarketDataUnavailableError, getMarkets } from "@/server/markets";
import { getPreferredCurrency } from "@/server/preferences";

export default function HomePage() {
  return (
    <PageShell
      title="Crypto markets"
      subtitle="The top 50 assets by market capitalisation, grouped into three categories."
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <InitialMarkets />
      </Suspense>
    </PageShell>
  );
}

/**
 * Renders the first snapshot on the server so the page is useful before any
 * JavaScript runs. If no data is available yet, the client takes over and
 * shows the error state with retry.
 */
async function InitialMarkets() {
  await connection();
  const initialCurrency = await getPreferredCurrency();
  let initialData = null;
  try {
    initialData = await getMarkets();
  } catch (error) {
    if (!(error instanceof MarketDataUnavailableError)) throw error;
  }
  return <MarketDashboard initialData={initialData} initialCurrency={initialCurrency} />;
}
