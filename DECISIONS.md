# Decisions

## Architecture

A Next.js app on one long-lived Node process (a container or `next start`) is both the UI and a small backend-for-frontend.

- **Server:** owns the CoinGecko key, the two fixed upstream requests, the caches, validation, and joining market data with our metadata. It exposes two read-only routes: `GET /api/markets` and `GET /api/coins/:id`.
- **Browser:** never talks to CoinGecko. It polls our API, owns view state (search, sort, category filter, watchlist, currency), converts values to the chosen currency and decides how fresh the data looks.
- **First paint:** the page is server-rendered with the cached snapshot inside a `<Suspense>` boundary, so data shows without waiting for JavaScript. The currency preference is a cookie, so the first paint already uses it. TanStack Query takes over polling after hydration.

The API can't act as a proxy because nothing from the request reaches upstream. Query strings and bodies are ignored, upstream parameters are fixed in code, ids are checked against a slug pattern, and only ids already in the cached top 50 are served. Any other id returns 404 without an upstream call.

## Categories and brand colours

Categories and brand colours are product decisions, not market data. They live in a typed module, [`asset-metadata.ts`](src/shared/asset-metadata.ts), keyed by CoinGecko id, because symbols collide.

- **Change process:** entries change through review, like code. A database or CMS would add a runtime dependency, and an admin UI, for roughly 50 rows that change a few times a year.
- **Provenance:** each colour records its source. `brand` means a published brand colour; `logo` means sampled from the official logo when no brand colour is published.
- **Contrast:** brand colours aren't designed for our background. Hyperliquid is pale mint and Canton is pale yellow, so the server derives a display accent that reaches WCAG's 3:1 ratio for graphics. Accents are used for rings and chart lines, never for text.
- **Joining:** the join happens on every read, not when data is cached. Changing a colour never requires refetching prices.
- **Unknown assets:** a coin that newly enters the top 50 lands in category C with a neutral grey, never a guessed colour. The server logs a warning, and `pnpm check:metadata` lists missing and departed entries, exiting non-zero so it can gate CI.

## Fetching, caching and freshness

One upstream call, `/coins/markets?per_page=50&sparkline=true`, returns the top 50 and a 7-day hourly series for each asset. The series powers the detail charts at no extra quota.

The [cache](src/server/cache/swr-cache.ts) is an in-process stale-while-revalidate cache:

- **Freshness window:** data younger than 5 minutes is served from memory.
- **Refresh:** after 5 minutes, the next request still gets the cached data immediately and triggers one background refresh. Concurrent callers share that single in-flight request.
- **Failures:** a failure keeps the last good snapshot. Retries back off exponentially (15 s, 30 s, 60 s, …) up to 5 minutes and honour `Retry-After`.
- **Cold start during an outage:** callers get a 503 with `Retry-After` and no further upstream calls, so traffic can't amplify an outage.
- **Bad responses:** empty, malformed or duplicate rows never replace good data. Malformed fields become `null`, never `0`.

Every response carries `fetchedAt` and `generatedAt`, both from the server's clock. The client computes age as `(generatedAt − fetchedAt) + time since it received the response`, so a wrong client clock can't make old data look fresh.

| Status     | Age                         | What the user sees                                                    |
| ---------- | --------------------------- | --------------------------------------------------------------------- |
| Up to date | ≤ interval + 90 s (6.5 min) | Green dot, the time since the last update and the refresh schedule    |
| Delayed    | ≤ 3 × interval (15 min)     | Warning banner with the cause, if known                               |
| Stale      | > 15 min                    | Red banner telling users not to trade on the prices, and muted prices |

Separately, a clock icon marks any asset that CoinGecko itself hasn't updated for over an hour.

### Currencies

Fetching `/coins/markets` once per currency would triple usage. Instead, a second small call, `/simple/price?ids=bitcoin&vs_currencies=usd,eur,gbp&include_24hr_change=true`, refreshes every 2 hours in its own cache.

- **Rates:** Bitcoin's price in each currency gives the exchange rate (`perUsd = btc.eur / btc.usd`). That is how CoinGecko converts between currencies itself.
- **24h change:** this can't just be reused. If a stablecoin is flat in USD while the dollar strengthens 0.5% against the euro, it rose 0.5% in EUR. Bitcoin's 24h change in each currency gives the rate's own 24h move, `(1 + btcEur) / (1 + btcUsd) − 1`, and each asset's change is restated as `(1 + changeUsd) × (1 + rateChange) − 1`. If the rate's change is unknown, the asset's change shows "—" rather than a guess.
- **Honesty:** non-USD views say "Converted from USD at 1 USD = €0.8902 · rate updated 34 min ago". If rates are unavailable, EUR and GBP are disabled and the view falls back to USD with a note. Prices never fail because of rates.
- **Trade-offs:** rates are up to 2 hours old, typically a few tenths of a percent of drift, which is small next to 5-minute-old crypto prices. The 7-day chart is converted at today's rate.

Clients poll every 30 s, which is cheap: each poll is about 4 ms from memory. A new snapshot therefore reaches users within 30 s of the server receiving it.

## API usage for 500 concurrent users

Upstream calls depend on time, not on the number of users: each server process makes at most one call per refresh interval.

|                                                            | Calculation                                 | Result                                                    |
| ---------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| Upstream, steady state                                     | 1 market call / 5 min + 1 rate call / 2 h   | ~0.21 calls/min                                           |
| Market calls, month (worst case: users all day, every day) | 31 × 24 × 60 / 5                            | 8,928                                                     |
| Rate calls, month                                          | 31 × 24 / 2                                 | 372                                                       |
| **Total, month**                                           | 8,928 + 372                                 | **9,300 calls (93% of 10,000)**                           |
| Headroom                                                   | 10,000 − 9,300                              | 700 calls for restarts (2 each) and `check:metadata` runs |
| Upstream, worst burst                                      | both cold starts plus retries at 15 s, 30 s | ≤ 6 calls/min, well under 100/min                         |
| Our server                                                 | 500 users / 30 s poll                       | ~17 req/s from memory                                     |

- **Which limit binds:** the monthly quota, not the per-minute rate. The interval is configurable, and the server warns at startup if it projects more than the quota. Only successful calls consume credits, so 429s during an outage don't count against the month.
- **Shorter intervals:** 1, 2 or 4 minutes would use 44,640, 22,320 or 11,160 market calls a month.
- **Options this rules out:**
  - Fetching EUR and GBP markets natively would triple usage, forcing a refresh of at least 15 minutes.
  - Per-asset chart endpoints refreshed hourly would cost about 37,200 calls a month.
  - Polling `/global` every 30 minutes would cost 1,488 calls a month, pushing the total over the quota at a 5-minute refresh.

## Correctness, failures and testing

- **Prices:** a non-zero price never rounds to `$0.00`. Prices under $1 keep 4 significant digits (`$0.000005158`), and output never uses scientific notation.
- **Missing values:** missing data shows as "—", never 0.
- **Direction and colour:** these follow the _rounded_ change, so −0.004% shows as a neutral `0.00%`, not a red `−0.00%`. Direction is always shown by sign and arrow as well as colour.
- **Category 24h change:** computed as `Σcap / Σ(cap / (1 + change)) − 1`, not as an average of percentages.
- **Converted 24h change:** restated through the exchange rate's own 24h move, never reused from USD.
- **Conversion order:** values are converted before sorting, filtering and category totals, so everything on screen uses the same numbers.

The tests (Vitest) focus on where bugs would cost money:

- formatting edge cases
- freshness thresholds and clock skew
- sorting with missing values
- category aggregates
- schema parsing of a real recorded CoinGecko response
- currency conversion, rate derivation and the monthly quota projection
- cache behaviour with a fake clock
- the real route handlers against a mocked upstream (MSW):
  - 500 concurrent requests make 1 upstream call
  - the API key never reaches the client
  - 429 and `Retry-After` are honoured
  - outages return 503 without repeated upstream calls
  - bad payloads don't overwrite good data
  - timeouts are handled
  - rates refresh every 2 hours, not with every price refresh, and prices still load when rates fail
- dashboard components: polling updates, stale and offline states, filters, sorting, the watchlist and currency switching, including the USD fallback
- the Tabs component: keyboard behaviour and disabled options

## Deliberately not built

- **Global market stats:** these need a second endpoint, and the quota is better spent on price freshness. Category aggregates come from data we already have.
- **WebSockets or server push:** upstream only changes every 5 minutes, so a 30 s poll is simpler and indistinguishable to users.
- **A database or CMS for metadata:** see above.
- **Rate limiting our own API:** it never generates upstream load. In production that belongs at the edge.

## First production improvements

1. **Shared cache and single poller.** The cache is per process, so N instances or serverless functions multiply upstream usage by N. Move snapshots to Redis behind one scheduled poller, or a distributed lock, and keep the freshness metadata.
2. **Observability.** Add metrics and alerts for refresh failures, snapshot age and monthly quota burn (CoinGecko's `/key` endpoint), plus a run of `check:metadata` in CI.
3. **End-to-end tests** (Playwright) for the stale and outage paths, and visual regression checks.
4. **Pacing by remaining quota:** spend quota saved during quiet hours on faster refreshes at peak times.

## AI tools

This project was built with an AI coding assistant (Claude Code). It was used to draft the code, tests and documentation from my design direction. I reviewed and verified the results by running the test suite, the production build and the app in a browser.
