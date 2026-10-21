"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { useCurrencyPreference, useDisplayCurrency } from "@/hooks/use-currency";
import { useFreshness, type ConnectionState } from "@/hooks/use-freshness";
import { useCoinHistory, useMarkets } from "@/hooks/use-market-data";
import { useNow } from "@/hooks/use-now";
import { useWatchlist } from "@/hooks/use-watchlist";
import { accentVars } from "@/lib/color";
import { toDisplayCoin } from "@/lib/currency-conversion";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatDuration,
  formatFullCurrency,
  formatPrice,
  formatRelativeAge,
} from "@/lib/format";
import { quoteLagMs } from "@/lib/freshness";
import { CATEGORIES } from "@/shared/categories";
import type { Currency } from "@/shared/currency";
import type { CoinHistoryResponse, MarketCoin, MarketsResponse } from "@/shared/market";
import { ConversionNote, CurrencySwitcher } from "../currency/currency-switcher";
import { FreshnessBanner, FreshnessIndicator } from "../freshness/freshness";
import { AssetAvatar } from "../ui/asset-avatar";
import { FlashOnChange } from "../ui/flash-on-change";
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
  initialMarkets,
  initialHistory,
  initialCurrency,
}: {
  id: string;
  initialMarkets: MarketsResponse | null;
  initialHistory: CoinHistoryResponse | null;
  initialCurrency: Currency;
}) {
  // Prices come from the shared markets snapshot, exactly as on the dashboard.
  const { data, error, isError, refetch, isRefetching, fetchStatus } = useMarkets(initialMarkets);
  const history = useCoinHistory(id, data?.meta.fetchedAt, initialHistory);
  const coin = data?.coins.find((c) => c.id === id);

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      {!data ? (
        isError ? (
          <ErrorState error={error} onRetry={() => refetch()} retrying={isRefetching} />
        ) : (
          <CoinDetailSkeleton />
        )
      ) : !coin ? (
        // The asset can drop out of the top 50 while the page is open.
        <div
          role="alert"
          className="rounded-xl border border-border bg-surface px-6 py-10 text-center"
        >
          <p className="font-medium">This asset is no longer in the top 50.</p>
          <p className="mt-1 text-sm text-muted">We only track the current top 50 by market cap.</p>
        </div>
      ) : (
        <CoinDetailView
          markets={data}
          marketCoin={coin}
          history={history.data?.prices ?? null}
          historyLoading={history.isPending}
          initialCurrency={initialCurrency}
          connection={{ error: isError ? error : null, offline: fetchStatus === "paused" }}
        />
      )}
    </div>
  );
}

function CoinDetailView({
  markets,
  marketCoin,
  history,
  historyLoading,
  initialCurrency,
  connection,
}: {
  markets: MarketsResponse & { receivedAt: number };
  marketCoin: MarketCoin;
  history: number[] | null;
  historyLoading: boolean;
  initialCurrency: Currency;
  connection: ConnectionState;
}) {
  const { meta } = markets;
  const freshness = useFreshness(meta, markets.receivedAt, connection);
  const { currency: requestedCurrency, setCurrency } = useCurrencyPreference(initialCurrency);
  const display = useDisplayCurrency(requestedCurrency, markets.fx);
  const { converter } = display;
  const { currency } = converter;
  const coin = useMemo(() => toDisplayCoin(marketCoin, converter), [marketCoin, converter]);
  // History is restated at today's rate; the FX move over 7 days is not modelled.
  const sparkline7d = useMemo(
    () => history?.map((usd) => converter.amount(usd)!) ?? null,
    [history, converter],
  );
  const { watchlist, toggle } = useWatchlist();
  const now = useNow();
  const lag = quoteLagMs(coin.lastUpdated, meta.fetchedAt);
  const isStale = freshness.freshness === "stale";

  const stats = [
    {
      label: "Market cap",
      value: formatCompactCurrency(coin.marketCap, currency),
      full: formatFullCurrency(coin.marketCap, currency),
    },
    {
      label: "Volume (24h)",
      value: formatCompactCurrency(coin.volume24h, currency),
      full: formatFullCurrency(coin.volume24h, currency),
    },
    { label: "24h high", value: formatPrice(coin.high24h, currency) },
    { label: "24h low", value: formatPrice(coin.low24h, currency) },
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
      className="animate-enter flex flex-col gap-6"
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
        <div className="flex items-center gap-2">
          <Link
            href={`/compare?ids=${coin.id},${coin.id === "bitcoin" ? "ethereum" : "bitcoin"}`}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm text-muted shadow-card transition-colors hover:text-fg"
          >
            Compare
          </Link>
          <CurrencySwitcher value={currency} onChange={setCurrency} fx={markets.fx} />
          <WatchToggle
            assetName={coin.name}
            watched={watchlist.has(coin.id)}
            onToggle={() => toggle(coin.id)}
            className="size-9 border border-border"
          />
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <FreshnessIndicator state={freshness} />
        <FreshnessBanner state={freshness} />
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p
            className={`text-4xl font-semibold tracking-tight tabular-nums ${isStale ? "text-muted" : ""}`}
            title={formatFullCurrency(coin.price, currency)}
          >
            <FlashOnChange value={coin.price} resetKey={currency}>
              {formatPrice(coin.price, currency)}
            </FlashOnChange>
          </p>
          <PriceChange value={coin.change24hPct} className="text-lg" />
          <span className="text-sm text-muted">24h</span>
        </div>
        <ConversionNote display={display} fx={markets.fx} />
        {lag !== null && (
          <p className="text-sm text-warn">
            CoinGecko last updated this price {formatDuration(lag)} before our latest snapshot, so
            it may not reflect the market.
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
        {sparkline7d ? (
          <PriceChart
            prices={sparkline7d}
            currency={currency}
            // Same convention as compare: the series ends at the snapshot time.
            endTime={Date.parse(meta.fetchedAt)}
            assetName={coin.name}
          />
        ) : historyLoading ? (
          <div aria-busy="true" className="h-64 animate-pulse rounded-lg bg-surface-muted" />
        ) : (
          <p className="py-12 text-center text-sm text-muted">No 7-day history is available.</p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-card sm:grid-cols-3">
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
