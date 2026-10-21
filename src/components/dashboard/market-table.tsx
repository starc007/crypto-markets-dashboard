"use client";

import Link from "next/link";
import { formatDuration, formatUsdCompact, formatUsdFull, formatUsdPrice } from "@/lib/format";
import { quoteLagMs } from "@/lib/freshness";
import type { SortKey, SortState } from "@/lib/market-view";
import type { MarketCoin } from "@/shared/market";
import { AssetAvatar } from "../ui/asset-avatar";
import { ArrowDownIcon, ArrowUpIcon, ClockIcon, SortIcon } from "../ui/icons";
import { PriceChange } from "../ui/price-change";
import { WatchToggle } from "../ui/watch-toggle";

interface MarketTableProps {
  coins: readonly MarketCoin[];
  labelledBy: string;
  sort: SortState;
  onSort: (key: SortKey) => void;
  fetchedAt: string;
  isStale: boolean;
  watchlist: ReadonlySet<string>;
  onToggleWatch: (id: string) => void;
}

interface Column {
  key: SortKey;
  label: string;
  className: string;
}

const NUMERIC_COLUMNS: Column[] = [
  { key: "price", label: "Price", className: "" },
  { key: "change24h", label: "24h", className: "hidden sm:table-cell" },
  { key: "volume", label: "Volume (24h)", className: "hidden md:table-cell" },
  { key: "marketCap", label: "Market cap", className: "hidden sm:table-cell" },
];

function SortableHeader({
  column,
  sort,
  onSort,
  align = "right",
}: {
  column: Pick<Column, "key" | "label" | "className">;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === column.key;
  const Icon = !active ? SortIcon : sort.direction === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
      className={`px-2 py-2 font-medium ${align === "right" ? "text-right" : "text-left"} ${column.className}`}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={`inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-fg ${
          active ? "text-fg" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {column.label}
        <Icon className={`size-3 ${active ? "" : "opacity-50"}`} />
      </button>
    </th>
  );
}

export function MarketTable({
  coins,
  labelledBy,
  sort,
  onSort,
  fetchedAt,
  isStale,
  watchlist,
  onToggleWatch,
}: MarketTableProps) {
  return (
    <div className="overflow-x-auto">
      <table aria-labelledby={labelledBy} className="w-full border-collapse text-sm">
        <thead className="border-b border-border text-xs text-muted">
          <tr>
            <th scope="col" className="w-8 py-2 pl-1 sm:w-10 sm:px-2">
              <span className="sr-only">Watchlist</span>
            </th>
            <th scope="col" className="hidden w-10 px-2 py-2 text-left font-medium lg:table-cell">
              #
            </th>
            <SortableHeader
              column={{ key: "name", label: "Asset", className: "" }}
              sort={sort}
              onSort={onSort}
              align="left"
            />
            {NUMERIC_COLUMNS.map((column) => (
              <SortableHeader key={column.key} column={column} sort={sort} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {coins.map((coin) => (
            <MarketRow
              key={coin.id}
              coin={coin}
              fetchedAt={fetchedAt}
              isStale={isStale}
              watched={watchlist.has(coin.id)}
              onToggleWatch={onToggleWatch}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketRow({
  coin,
  fetchedAt,
  isStale,
  watched,
  onToggleWatch,
}: {
  coin: MarketCoin;
  fetchedAt: string;
  isStale: boolean;
  watched: boolean;
  onToggleWatch: (id: string) => void;
}) {
  const lag = quoteLagMs(coin.lastUpdated, fetchedAt);
  const valueTone = isStale ? "text-muted" : "";

  return (
    <tr className="group relative border-b border-border last:border-b-0 hover:bg-surface-muted">
      <td className="relative z-10 py-2.5 pl-1 sm:px-2">
        <WatchToggle
          assetName={coin.name}
          watched={watched}
          onToggle={() => onToggleWatch(coin.id)}
        />
      </td>
      <td className="hidden px-2 py-2.5 text-muted tabular-nums lg:table-cell">
        {coin.rank ?? "—"}
      </td>
      <td className="px-2 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <AssetAvatar symbol={coin.symbol} imageUrl={coin.imageUrl} accent={coin.accent} />
          <div className="min-w-0">
            {/* The link's ::after covers the row, making the whole row a target. */}
            <Link
              href={`/coins/${coin.id}`}
              className="block truncate font-medium after:absolute after:inset-0 after:content-['']"
            >
              {coin.name}
            </Link>
            <span className="text-xs text-muted">{coin.symbol}</span>
          </div>
        </div>
      </td>
      <td
        className={`px-2 py-2.5 text-right font-medium whitespace-nowrap tabular-nums ${valueTone}`}
      >
        <span className="inline-flex items-center gap-1">
          {lag !== null && (
            <span
              className="text-warn"
              title={`CoinGecko last updated this price ${formatDuration(lag)} before this snapshot`}
            >
              <ClockIcon className="size-3.5" />
              <span className="sr-only">Price may be outdated.</span>
            </span>
          )}
          <span title={formatUsdFull(coin.priceUsd)}>{formatUsdPrice(coin.priceUsd)}</span>
        </span>
        {/* Small screens show the 24h change under the price instead of in its own column. */}
        <div className="text-xs font-normal sm:hidden">
          <PriceChange value={coin.change24hPct} className={isStale ? "opacity-70" : ""} />
        </div>
      </td>
      <td className="hidden px-2 py-2.5 text-right whitespace-nowrap sm:table-cell">
        <PriceChange value={coin.change24hPct} className={isStale ? "opacity-70" : ""} />
      </td>
      <td
        className={`hidden px-2 py-2.5 text-right whitespace-nowrap tabular-nums md:table-cell ${valueTone}`}
        title={formatUsdFull(coin.volume24hUsd)}
      >
        {formatUsdCompact(coin.volume24hUsd)}
      </td>
      <td
        className={`hidden px-2 py-2.5 text-right whitespace-nowrap tabular-nums sm:table-cell ${valueTone}`}
        title={formatUsdFull(coin.marketCapUsd)}
      >
        {formatUsdCompact(coin.marketCapUsd)}
      </td>
    </tr>
  );
}
