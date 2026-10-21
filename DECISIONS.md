# Decisions

## Architecture

A Next.js app on one long-lived Node process (a container or `next start`) is both the UI and a small backend-for-frontend.

- **Server:** owns the CoinGecko key, the single upstream request, the cache, validation, and joining market data with our metadata. It exposes two read-only routes: `GET /api/markets` and `GET /api/coins/:id`.
- **Browser:** never talks to CoinGecko. It polls our API, owns view state (search, sort, category filter, watchlist) and decides how fresh the data looks.
- **First paint:** the page is server-rendered with the cached snapshot inside a `<Suspense>` boundary, so data shows without waiting for JavaScript. TanStack Query takes over polling after hydration.

The API can't act as a proxy because nothing from the request reaches upstream. Query strings and bodies are ignored, upstream parameters are fixed in code, ids are checked against a slug pattern, and only ids already in the cached top 50 are served. Any other id returns 404 without an upstream call.

## Categories and brand colours

Categories and brand colours are product decisions, not market data. They live in a typed module, [`asset-metadata.ts`](src/shared/asset-metadata.ts), keyed by CoinGecko id, because symbols collide.

- **Change process:** entries change through review, like code. A database or CMS would add a runtime dependency, and an admin UI, for roughly 50 rows that change a few times a year.
- **Provenance:** each colour records its source. `brand` means a published brand colour; `logo` means sampled from the official logo when no brand colour is published.
- **Contrast:** brand colours aren't designed for our backgrounds. XRP is near black and Hyperliquid is pale mint, so the server derives per-theme accents that reach WCAG's 3:1 ratio for graphics. Accents are used for rings and chart lines, never for text.
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

| Status  | Age                         | What the user sees                                                    |
| ------- | --------------------------- | --------------------------------------------------------------------- |
| Live    | ≤ interval + 90 s (6.5 min) | Green dot and the time since the last update                          |
| Delayed | ≤ 3 × interval (15 min)     | Warning banner with the cause, if known                               |
| Stale   | > 15 min                    | Red banner telling users not to trade on the prices, and muted prices |

Separately, a clock icon marks any asset that CoinGecko itself hasn't updated for over an hour.

Clients poll every 30 s, which is cheap: each poll is about 4 ms from memory. A new snapshot therefore reaches users within 30 s of the server receiving it.

## API usage for 500 concurrent users

Upstream calls depend on time, not on the number of users: each server process makes at most one call per refresh interval.

|                                                        | Calculation                              | Result                                                      |
| ------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------- |
| Upstream, steady state                                 | 1 call / 5 min                           | 0.2 calls/min                                               |
| Upstream, month (worst case: users all day, every day) | 31 × 24 × 60 / 5                         | **8,928 calls (89% of 10,000)**                             |
| Headroom                                               | 10,000 − 8,928                           | 1,072 calls for restarts (1 each) and `check:metadata` runs |
| Upstream, worst burst                                  | cold start plus retries at 15 s and 30 s | ≤ 3 calls/min, well under 100/min                           |
| Our server                                             | 500 users / 30 s poll                    | ~17 req/s from memory                                       |

- **Which limit binds:** the monthly quota, not the per-minute rate. The interval is configurable, and the server warns at startup if it projects more than the quota. Only successful calls consume credits, so 429s during an outage don't count against the month.
- **Shorter intervals:** 1, 2 or 4 minutes would use 44,640, 22,320 or 11,160 calls a month.
- **Options this rules out:**
  - Server-side currency conversion that fetches EUR and GBP natively would triple usage, forcing a refresh of at least 15 minutes.
  - Per-asset chart endpoints refreshed hourly would cost about 37,200 calls a month.
  - Polling `/global` every 30 minutes would cost 1,488 calls a month, forcing the markets refresh down to 6 minutes.

## Correctness, failures and testing

- **Prices:** a non-zero price never rounds to `$0.00`. Prices under $1 keep 4 significant digits (`$0.000005158`), and output never uses scientific notation.
- **Missing values:** missing data shows as "—", never 0.
- **Direction and colour:** these follow the _rounded_ change, so −0.004% shows as a neutral `0.00%`, not a red `−0.00%`. Direction is always shown by sign and arrow as well as colour.
- **Category 24h change:** computed as `Σcap / Σ(cap / (1 + change)) − 1`, not as an average of percentages.

The tests (Vitest) focus on where bugs would cost money:

- formatting edge cases
- freshness thresholds and clock skew
- sorting with missing values
- category aggregates
- schema parsing of a real recorded CoinGecko response
- cache behaviour with a fake clock
- the real route handlers against a mocked upstream (MSW):
  - 500 concurrent requests make 1 upstream call
  - the API key never reaches the client
  - 429 and `Retry-After` are honoured
  - outages return 503 without repeated upstream calls
  - bad payloads don't overwrite good data
  - timeouts are handled
- dashboard components: polling updates, stale and offline states, filters, sorting and the watchlist

## Deliberately not built

- **Currency selection:** it costs 3× quota natively. Converting USD with FX rates would make 24h changes subtly wrong.
- **Global market stats:** these need a second endpoint, and the quota is better spent on price freshness. Category aggregates come from data we already have.
- **WebSockets or server push:** upstream only changes every 5 minutes, so a 30 s poll is simpler and indistinguishable to users.
- **A database or CMS for metadata:** see above.
- **Rate limiting our own API:** it never generates upstream load. In production that belongs at the edge.

## First production improvements

1. **Shared cache and single poller.** The cache is per process, so N instances or serverless functions multiply upstream usage by N. Move snapshots to Redis behind one scheduled poller, or a distributed lock, and keep the freshness metadata.
2. **Observability.** Add metrics and alerts for refresh failures, snapshot age and monthly quota burn (CoinGecko's `/key` endpoint), plus a run of `check:metadata` in CI.
3. **End-to-end tests** (Playwright) for the stale and outage paths, and visual checks of both themes.
4. **Pacing by remaining quota:** spend quota saved during quiet hours on faster refreshes at peak times.

## AI tools

This project was built with an AI coding assistant (Claude Code). It was used to draft the code, tests and documentation from my design direction. I reviewed and verified the results by running the test suite, the production build and the app in a browser.
