import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/compare/compare-view";
import { PageShell } from "@/components/page-shell";
import { isValidCoinId } from "@/shared/coin-id";
import { MAX_COMPARED } from "@/shared/compare";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <PageShell
      title="Compare"
      subtitle="How assets moved against each other over the last 7 days, starting from 0%."
    >
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />}>
        <CompareLoader searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

/** Reads `?ids=` once; from then on the client keeps the URL in sync. */
async function CompareLoader({ searchParams }: Pick<PageProps<"/compare">, "searchParams">) {
  const raw = (await searchParams).ids;
  const ids = [
    ...new Set(
      (Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
        .split(",")
        .map((id) => id.trim())
        .filter(isValidCoinId),
    ),
  ].slice(0, MAX_COMPARED);
  return <CompareView initialIds={ids} />;
}
