"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useElementWidth } from "@/hooks/use-element-width";
import type { DisplayCoin } from "@/lib/currency-conversion";
import { formatCompactCurrency, formatPercentChange, formatPrice } from "@/lib/format";
import {
  CATEGORY_LABEL_HEIGHT,
  HEAT_SATURATION_PCT,
  heatColor,
  layoutHeatmap,
  type HeatmapLayout,
} from "@/lib/heatmap";
import { CATEGORIES, type CategoryId } from "@/shared/categories";
import type { Currency } from "@/shared/currency";
import { FlashOnChange } from "../ui/flash-on-change";
import { Sparkline } from "../ui/sparkline";

const MotionLink = motion.create(Link);
const TILE_SPRING = { type: "spring", stiffness: 260, damping: 32 } as const;

interface MarketHeatmapProps {
  groups: Record<CategoryId, DisplayCoin[]>;
  currency: Currency;
  isStale: boolean;
}

/** Taller on narrow screens, so small assets still get usable tiles. */
function canvasHeight(width: number): number {
  return width < 640
    ? Math.round(Math.max(520, width * 1.4))
    : Math.round(Math.min(640, Math.max(440, width * 0.56)));
}

function tileLabel(coin: DisplayCoin, currency: Currency): string {
  const change = formatPercentChange(coin.change24hPct);
  return `${coin.name} (${coin.symbol}): ${formatPrice(coin.price, currency)}, ${change.label} in 24 hours, market cap ${formatCompactCurrency(coin.marketCap, currency)}`;
}

/**
 * Treemap of the visible assets: area is market cap, colour is the 24h
 * change. Tiles are links, so the map is keyboard navigable, and each has a
 * full text label because colour and size alone can't be read by everyone.
 */
export function MarketHeatmap({ groups, currency, isStale }: MarketHeatmapProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const height = width ? canvasHeight(width) : 520;
  const layout = useMemo<HeatmapLayout | null>(
    () => (width ? layoutHeatmap(groups, width, height) : null),
    [groups, width, height],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = layout?.tiles.find((tile) => tile.coin.id === activeId) ?? null;

  return (
    <section
      aria-label="Market heatmap"
      className="animate-enter rounded-2xl border border-border bg-surface p-3 shadow-card"
    >
      <p className="sr-only">
        Each tile is an asset. Its size shows market cap and its colour shows the 24-hour change.
      </p>
      <div
        ref={ref}
        className={`relative transition-[filter,opacity] duration-500 ${isStale ? "opacity-75 grayscale-[0.6]" : ""}`}
        style={{ height }}
        onPointerLeave={() => setActiveId(null)}
      >
        {layout?.categories.map((category) => (
          <div
            key={category.id}
            className="absolute rounded-xl bg-surface-muted"
            style={{
              left: category.x,
              top: category.y,
              width: category.width,
              height: category.height,
            }}
          >
            <h3
              className="truncate px-2 text-xs font-medium text-muted"
              style={{ lineHeight: `${CATEGORY_LABEL_HEIGHT}px` }}
            >
              <span className="font-semibold text-fg">{category.id}</span> ·{" "}
              {CATEGORIES[category.id].name}
            </h3>
          </div>
        ))}

        <AnimatePresence initial={false}>
          {layout?.tiles.map(({ coin, x, y, width: w, height: h }) => {
            const color = heatColor(coin.change24hPct);
            const change = formatPercentChange(coin.change24hPct);
            const showSymbol = w >= 44 && h >= 26;
            const showChange = w >= 56 && h >= 40;
            const showPrice = w >= 96 && h >= 68;
            const fontSize = Math.max(11, Math.min(30, Math.min(w, h) / 4.2));
            return (
              <MotionLink
                key={coin.id}
                href={`/coins/${coin.id}`}
                aria-label={tileLabel(coin, currency)}
                onPointerEnter={() => setActiveId(coin.id)}
                onFocus={() => setActiveId(coin.id)}
                onBlur={() => setActiveId(null)}
                initial={{ opacity: 0, scale: 0.9, left: x, top: y, width: w, height: h }}
                animate={{ opacity: 1, scale: 1, left: x, top: y, width: w, height: h }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                transition={TILE_SPRING}
                whileHover={{ scale: w > 40 && h > 40 ? 1.015 : 1, zIndex: 10 }}
                className="absolute flex flex-col items-center justify-center overflow-hidden rounded-md px-1 text-center outline-offset-1 focus-visible:z-20"
                style={{ background: color.background, color: color.text }}
              >
                {showSymbol && (
                  <span className="leading-tight font-semibold" style={{ fontSize }}>
                    {coin.symbol}
                  </span>
                )}
                {showPrice && (
                  <FlashOnChange value={coin.price} resetKey={currency}>
                    <span className="text-xs tabular-nums opacity-90">
                      {formatPrice(coin.price, currency)}
                    </span>
                  </FlashOnChange>
                )}
                {showChange && (
                  <span
                    className="text-xs font-medium tabular-nums opacity-90"
                    style={{ fontSize: Math.max(11, fontSize * 0.55) }}
                  >
                    {change.text}
                  </span>
                )}
              </MotionLink>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {active && (
            <HeatmapTooltip
              key="tooltip"
              tile={active}
              canvasWidth={width ?? 0}
              currency={currency}
            />
          )}
        </AnimatePresence>
      </div>

      <HeatmapLegend excludedCount={layout?.excluded.length ?? 0} />
    </section>
  );
}

const TOOLTIP_WIDTH = 220;

function HeatmapTooltip({
  tile,
  canvasWidth,
  currency,
}: {
  tile: HeatmapLayout["tiles"][number];
  canvasWidth: number;
  currency: Currency;
}) {
  const { coin } = tile;
  const left = Math.min(
    Math.max(0, tile.x + tile.width / 2 - TOOLTIP_WIDTH / 2),
    canvasWidth - TOOLTIP_WIDTH,
  );
  // Prefer above the tile; flip below when there's no room.
  const above = tile.y > 120;
  const top = above ? tile.y - 8 : tile.y + tile.height + 8;
  const change = formatPercentChange(coin.change24hPct);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute z-30 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg"
      // `translate` is independent of motion's transforms, so it can anchor the tooltip's bottom edge.
      style={{ width: TOOLTIP_WIDTH, translate: above ? "0 -100%" : undefined }}
      initial={{ opacity: 0, scale: 0.96, left, top }}
      animate={{ opacity: 1, scale: 1, left, top }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    >
      <p className="flex items-baseline justify-between gap-2">
        <span className="truncate font-semibold">{coin.name}</span>
        <span className="text-xs text-muted">{coin.symbol}</span>
      </p>
      <p className="mt-1 flex items-baseline justify-between gap-2 tabular-nums">
        <span className="font-medium">{formatPrice(coin.price, currency)}</span>
        <span
          className={
            change.direction === "up"
              ? "text-up"
              : change.direction === "down"
                ? "text-down"
                : "text-muted"
          }
        >
          {change.text}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-muted">
        Market cap {formatCompactCurrency(coin.marketCap, currency)}
      </p>
      <div className="mt-2">
        <Sparkline values={coin.trend7d} />
        <span className="ml-2 text-xs text-muted">7 days</span>
      </div>
    </motion.div>
  );
}

function HeatmapLegend({ excludedCount }: { excludedCount: number }) {
  const stops = [
    -HEAT_SATURATION_PCT,
    -HEAT_SATURATION_PCT / 2,
    0,
    HEAT_SATURATION_PCT / 2,
    HEAT_SATURATION_PCT,
  ];
  const gradient = `linear-gradient(to right, ${stops.map((pct) => heatColor(pct).background).join(", ")})`;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1 text-xs text-muted">
      <p>Size shows market cap · colour shows 24h change</p>
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="tabular-nums">−{HEAT_SATURATION_PCT}%</span>
        <span className="h-2 w-32 rounded-full" style={{ background: gradient }} />
        <span className="tabular-nums">+{HEAT_SATURATION_PCT}%</span>
      </div>
      {excludedCount > 0 && (
        <p className="w-full">
          {excludedCount} {excludedCount === 1 ? "asset is" : "assets are"} hidden because the
          market cap is unknown.
        </p>
      )}
    </div>
  );
}
