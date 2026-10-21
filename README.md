# Crypto Markets Dashboard

A dashboard of the top 50 cryptocurrencies by market capitalisation. Prices update automatically and the page states clearly how fresh they are. It is built with Next.js 16, React 19 and TypeScript, using market data from the [CoinGecko API](https://www.coingecko.com/en/api).

- The top 50 assets, grouped into three categories (A, B and C), showing price, 24h change, volume and market cap.
- Automatic refresh with a **Live / Delayed / Stale** status. Users are always told how old the data is and why.
- Accurate formatting for very small prices and missing data, plus per-asset brand colours.
- USD, EUR and GBP, with 24h changes correctly restated in each currency and the conversion rate always shown.
- Search, category filter, sorting, a persistent watchlist, and asset pages with an interactive 7-day chart.
- Animated segmented tabs (built with [Motion](https://motion.dev)) that are a native radio group underneath, and that respect reduced motion.
- Responsive and accessible: keyboard-operable controls, sort state exposed to screen readers, live regions that don't spam, and light and dark themes.

Design decisions, caching strategy and API quota calculations are in [DECISIONS.md](DECISIONS.md).

## Quick start

You need Node.js 20.19 or later, and pnpm (`corepack enable` provides it).

```bash
pnpm install
cp .env.example .env.local   # optionally add your CoinGecko Demo key
pnpm dev
```

Then open http://localhost:3000.

The app runs without an API key, using CoinGecko's keyless public API with lower rate limits. For realistic limits, create a free Demo key at the [CoinGecko developer dashboard](https://www.coingecko.com/en/developers/dashboard).

## Configuration

| Variable                           | Default   | Description                                                                                                                                                                       |
| ---------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COINGECKO_API_KEY`                | _(empty)_ | CoinGecko Demo API key. It is read on the server only and never sent to the browser.                                                                                              |
| `MARKETS_REFRESH_INTERVAL_SECONDS` | `300`     | How long a snapshot is served before refreshing (60 to 3600). Exchange rates refresh every 2 hours. The server warns at startup if the total could exceed the monthly Demo quota. |

## Scripts

| Command                                              | What it does                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                           | Start the development server                                              |
| `pnpm build && pnpm start`                           | Production build and server                                               |
| `pnpm test`                                          | Run all tests once (`pnpm test:watch` to watch)                           |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Static checks                                                             |
| `pnpm verify`                                        | Run every check above                                                     |
| `pnpm check:metadata`                                | List top-50 assets missing a curated category or colour (uses 1 API call) |

The tests make no network calls: the upstream API is mocked with [MSW](https://mswjs.io).

## How it works

```
Browser ──poll every 30s──▶ /api/markets ─┐     in-process SWR caches, shared by all users
                                          ├─▶ markets ──≤1 call / 5 min──▶ CoinGecko /coins/markets
Browser ──────────────────▶ /api/coins/:id┘   rates   ──≤1 call / 2 h────▶ CoinGecko /simple/price
```

```
src/
  app/                 Pages and route handlers (thin: they delegate to src/server)
  server/              Server only: CoinGecko client, schema validation, SWR caches, metadata join
  shared/              Wire types, categories, curated asset metadata
  lib/                 Pure logic: formatting, currency conversion, freshness, sorting, colour contrast
  hooks/               Polling queries, watchlist and currency preferences, shared clock
  components/          UI, split into dashboard, coin detail, currency, freshness and primitives (ui/)
```

## Known limitations

- **The cache is per process.** Quota calculations assume one long-lived server. Running several instances, or serverless functions, multiplies upstream calls. See "First production improvements" in [DECISIONS.md](DECISIONS.md).
- **Restarts empty the caches,** and each restart costs two upstream calls.
- **EUR and GBP values are converted from USD** at rates up to 2 hours old, and the 7-day chart uses today's rate. Details are in [DECISIONS.md](DECISIONS.md).
- **Chart times are approximate.** The 7-day chart uses CoinGecko's sparkline, which has hourly points but no timestamps.
- **The watchlist is per browser** (`localStorage`). There are no accounts.
- **Metadata is curated by hand.** A new top-50 asset falls back to category C and a neutral colour until it is added.
- **Unknown asset pages return HTTP 200, not 404.** The prerendered shell streams before the asset is resolved. The page still shows "Not found" and is marked `noindex`. The JSON API returns a proper 404.
