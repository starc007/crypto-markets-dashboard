"use client";

import {
  INITIAL_DIRECTION,
  type SortDirection,
  type SortKey,
  type SortState,
} from "@/lib/market-view";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/shared/categories";
import { SearchIcon, StarIcon } from "../ui/icons";

export type CategoryFilter = CategoryId | "all";

interface ToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  watchlistOnly: boolean;
  onWatchlistOnlyChange: (value: boolean) => void;
  watchlistCount: number;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

const SORT_LABELS: Record<SortKey, string> = {
  marketCap: "Market cap",
  price: "Price",
  change24h: "24h change",
  volume: "Volume",
  name: "Name",
};

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string; title?: string }[] = [
  { value: "all", label: "All" },
  ...CATEGORY_IDS.map((id) => ({ value: id, label: id, title: CATEGORIES[id].name })),
];

export function Toolbar(props: ToolbarProps) {
  const { sort, onSortChange } = props;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative md:w-72">
        <label htmlFor="asset-search" className="sr-only">
          Search assets
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          id="asset-search"
          type="search"
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          placeholder="Search name or symbol"
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm placeholder:text-muted"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="flex rounded-lg border border-border bg-surface p-0.5">
          <legend className="sr-only">Category</legend>
          {CATEGORY_OPTIONS.map((option) => (
            <label
              key={option.value}
              title={option.title}
              className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted has-checked:bg-surface-muted has-checked:font-medium has-checked:text-fg has-focus-visible:outline-2 has-focus-visible:outline-focus"
            >
              <input
                type="radio"
                name="category"
                value={option.value}
                checked={props.category === option.value}
                onChange={() => props.onCategoryChange(option.value)}
                className="sr-only"
              />
              {option.label}
              {option.title && <span className="sr-only">: {option.title}</span>}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          aria-pressed={props.watchlistOnly}
          onClick={() => props.onWatchlistOnlyChange(!props.watchlistOnly)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm ${
            props.watchlistOnly
              ? "border-amber-500/60 bg-amber-500/10 font-medium text-fg"
              : "border-border bg-surface text-muted hover:text-fg"
          }`}
        >
          <StarIcon filled={props.watchlistOnly} className="size-3.5 text-amber-500" />
          Watchlist
          <span className="tabular-nums">({props.watchlistCount})</span>
        </button>

        {/* Column headers sort on larger screens; small screens hide some columns. */}
        <div className="flex items-center gap-2 sm:hidden">
          <label htmlFor="sort-select" className="text-sm text-muted">
            Sort
          </label>
          <select
            id="sort-select"
            value={`${sort.key}:${sort.direction}`}
            onChange={(e) => {
              const [key, direction] = e.target.value.split(":") as [SortKey, SortDirection];
              onSortChange({ key, direction });
            }}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
              const first = INITIAL_DIRECTION[key];
              const second: SortDirection = first === "desc" ? "asc" : "desc";
              return [first, second].map((direction) => (
                <option key={`${key}:${direction}`} value={`${key}:${direction}`}>
                  {SORT_LABELS[key]} ({directionLabel(key, direction)})
                </option>
              ));
            })}
          </select>
        </div>
      </div>
    </div>
  );
}

function directionLabel(key: SortKey, direction: SortDirection): string {
  if (key === "name") return direction === "asc" ? "A–Z" : "Z–A";
  return direction === "desc" ? "high to low" : "low to high";
}
