import { formatUsdCompact, formatUsdFull } from "@/lib/format";
import type { CategorySummary } from "@/lib/market-view";
import type { Category } from "@/shared/categories";
import { PriceChange } from "../ui/price-change";
import type { ReactNode } from "react";

interface CategorySectionProps {
  category: Category;
  /** Totals for the whole category, independent of search filters. */
  summary: CategorySummary;
  visibleCount: number;
  children: (headingId: string) => ReactNode;
}

export function CategorySection({
  category,
  summary,
  visibleCount,
  children,
}: CategorySectionProps) {
  const headingId = `category-${category.id}`;
  const filtered = visibleCount !== summary.count;

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-xl border border-border bg-surface"
    >
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold">
            <span
              aria-hidden="true"
              className="inline-flex size-6 items-center justify-center rounded-md bg-surface-muted text-xs font-bold"
            >
              {category.id}
            </span>
            <span>
              <span className="sr-only">Category {category.id}: </span>
              {category.name}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">{category.description}</p>
        </div>
        <dl className="flex gap-5 text-xs">
          <div>
            <dt className="text-muted">Assets</dt>
            <dd className="font-medium tabular-nums">
              {filtered ? `${visibleCount} of ${summary.count}` : summary.count}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Market cap</dt>
            <dd
              className="font-medium tabular-nums"
              title={formatUsdFull(summary.totalMarketCapUsd)}
            >
              {formatUsdCompact(summary.totalMarketCapUsd)}
            </dd>
          </div>
          <div>
            <dt className="text-muted" title="Change in the category's combined market value">
              24h
            </dt>
            <dd className="font-medium">
              <PriceChange value={summary.change24hPct} />
            </dd>
          </div>
        </dl>
      </header>
      {children(headingId)}
    </section>
  );
}
