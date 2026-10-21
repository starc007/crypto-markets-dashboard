"use client";

import { motion } from "motion/react";
import { formatCompactCurrency, formatFullCurrency } from "@/lib/format";
import type { CategorySummary } from "@/lib/market-view";
import type { Category, CategoryId } from "@/shared/categories";
import type { Currency } from "@/shared/currency";
import { FlashOnChange } from "../ui/flash-on-change";
import { PriceChange } from "../ui/price-change";
import type { ReactNode } from "react";

const BADGE_TONE: Record<CategoryId, string> = {
  A: "bg-sky-50 text-sky-800 ring-sky-200",
  B: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  C: "bg-amber-50 text-amber-800 ring-amber-200",
};

interface CategorySectionProps {
  category: Category;
  /** Totals for the whole category, independent of search filters. */
  summary: CategorySummary;
  currency: Currency;
  visibleCount: number;
  /** Position on the page, used to stagger the entrance. */
  index: number;
  children: (headingId: string) => ReactNode;
}

export function CategorySection({
  category,
  summary,
  currency,
  visibleCount,
  index,
  children,
}: CategorySectionProps) {
  const headingId = `category-${category.id}`;
  const filtered = visibleCount !== summary.count;

  return (
    <motion.section
      layout="position"
      aria-labelledby={headingId}
      initial={false}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      transition={{ layout: { type: "spring", stiffness: 400, damping: 40 } }}
      // The entrance is CSS so server-rendered content animates without waiting for JavaScript.
      style={{ animationDelay: `${index * 70}ms` }}
      className="animate-enter overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
    >
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold">
            <span
              aria-hidden="true"
              className={`inline-flex size-6 items-center justify-center rounded-md text-xs font-bold ring-1 ring-inset ${BADGE_TONE[category.id]}`}
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
              title={formatFullCurrency(summary.totalMarketCap, currency)}
            >
              <FlashOnChange value={summary.totalMarketCap} resetKey={currency}>
                {formatCompactCurrency(summary.totalMarketCap, currency)}
              </FlashOnChange>
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
    </motion.section>
  );
}
