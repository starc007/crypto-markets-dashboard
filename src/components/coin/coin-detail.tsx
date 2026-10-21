"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCoinDetail } from "@/hooks/use-market-data";
import { useNow } from "@/hooks/use-now";
import { useWatchlist } from "@/hooks/use-watchlist";
import { ApiError } from "@/lib/api-client";
import { accentVars } from "@/lib/color";
import {
  formatCompactNumber,
  formatDuration,
  formatRelativeAge,
  formatUsdCompact,
  formatUsdFull,
  formatUsdPrice,
} from "@/lib/format";
import { quoteLagMs } from "@/lib/freshness";
import { CATEGORIES } from "@/shared/categories";
import type { CoinDetailResponse } from "@/shared/market";
import { FreshnessBanner, FreshnessIndicator, useFreshness } from "../freshness/freshness";
import { AssetAvatar } from "../ui/asset-avatar";
import { ErrorState } from "../ui/error-state";
import { ChevronLeftIcon } from "../ui/icons";
import { PriceChange } from "../ui/price-change";
import { WatchToggle } from "../ui/watch-toggle";
import { PriceChart } from "./price-chart";

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-fg"
    >
      <ChevronLeftIcon className="size-4" />
      All markets
    </Link>
  );
}

export function CoinDetail({
  id,
  initialData,
}: {
  id: string;
  initialData: CoinDetailResponse | null;
}) {
  const { data, error, isError, refetch, isRefetching } = useCoinDetail(id, initialData);
  // The asset can drop out of the top 50 while the page is open.
  const droppedOut = error instanceof ApiError && error.code === "NOT_FOUND";

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      {droppedOut ? (
        <div
          role="alert"
          className="rounded-xl border border-border bg-surface px-6 py-10 text-center"
        >
          <p className="font-medium">This asset is no longer in the top 50.</p>
          <p className="mt-1 text-sm text-muted">We only track the current top 50 by market cap.</p>
        </div>
      ) : data ? (
        <CoinDetailView data={data} clientError={isError ? error : null} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} retrying={isRefetching} />
      ) : (
        <CoinDetailSkeleton />
      )}
    </div>
  );
}

function CoinDetailView({
  data,
  clientError,
}: {
  data: CoinDetailResponse & { receivedAt: number };
  clientError: Error | null;
}) {
  const { coin, sparkline7d, meta } = data;
  const freshness = useFreshness(meta, data.receivedAt, clientError);
  const { watchlist, toggle } = useWatchlist();
  const now = useNow();
  const lag = quoteLagMs(coin.lastUpdated, meta.fetchedAt);
  const isStale = freshness.freshness === "stale";

  const stats = [
    {
      label: "Market cap",
      value: formatUsdCompact(coin.marketCapUsd),
      full: formatUsdFull(coin.marketCapUsd),
    },
    {
      label: "Volume (24h)",
      value: formatUsdCompact(coin.volume24hUsd),
      full: formatUsdFull(coin.volume24hUsd),
    },
    { label: "24h high", value: formatUsdPrice(coin.high24hUsd) },
    { label: "24h low", value: formatUsdPrice(coin.low24hUsd) },
    {
      label: "Circulating supply",
      value:
        coin.circulatingSupply === null
          ? formatCompactNumber(null)
          : `${formatCompactNumber(coin.circulatingSupply)} ${coin.symbol}`,
    },
    {
      label: "Price last updated",
      value:
        coin.lastUpdated && now !== null
          ? formatRelativeAge(now - Date.parse(coin.lastUpdated))
          : coin.lastUpdated
            ? "…"
            : "—",
    },
  ];

  return (
    <article
      className="asset-accent flex flex-col gap-6"
      style={accentVars(coin.accent) as CSSProperties}
      aria-labelledby="coin-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <AssetAvatar
            symbol={coin.symbol}
            imageUrl={coin.imageUrl}
            accent={coin.accent}
            size={48}
          />
          <div>
            <h1 id="coin-title" className="text-2xl font-semibold tracking-tight">
              {coin.name} <span className="text-base font-normal text-muted">{coin.symbol}</span>
            </h1>
            <p className="text-sm text-muted">
              {coin.rank !== null && <>Rank #{coin.rank} · </>}
              Category {coin.category}: {CATEGORIES[coin.category].name}
            </p>
          </div>
        </div>
        <WatchToggle
          assetName={coin.name}
          watched={watchlist.has(coin.id)}
          onToggle={() => toggle(coin.id)}
          className="border border-border"
        />
      </header>

      <div className="flex flex-col gap-3">
        <FreshnessIndicator state={freshness} />
        <FreshnessBanner state={freshness} />
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p
            className={`text-4xl font-semibold tracking-tight tabular-nums ${isStale ? "text-muted" : ""}`}
            title={formatUsdFull(coin.priceUsd)}
          >
            {formatUsdPrice(coin.priceUsd)}
          </p>
          <PriceChange value={coin.change24hPct} className="text-lg" />
          <span className="text-sm text-muted">24h</span>
        </div>
        {lag !== null && (
          <p className="text-sm text-warn">
            CoinGecko last updated this price {formatDuration(lag)} before our latest snapshot, so
            it may not reflect the market.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        {sparkline7d ? (
          <PriceChart
            prices={sparkline7d}
            endTime={Date.parse(coin.lastUpdated ?? meta.fetchedAt)}
            assetName={coin.name}
          />
        ) : (
          <p className="py-12 text-center text-sm text-muted">No 7-day history is available.</p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd className="mt-1 font-medium tabular-nums" title={stat.full}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function CoinDetailSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading asset…</span>
      <div className="flex items-center gap-4">
        <div className="size-12 animate-pulse rounded-full bg-surface-muted" />
        <div className="h-7 w-48 animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="h-10 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
    </div>
  );
}
