# Decisions

## Architecture

Next.js on one long-lived Node process acts as both UI and backend-for-frontend. The **server** owns the CoinGecko key, two fixed upstream requests, the caches, validation and the metadata join. The **browser** never calls CoinGecko: it polls `GET /api/markets`, the **single source of prices** on every page (charts fetch history keyed to the same snapshot), and owns view state (search, sort, filters, watchlist, currency). Pages are server-rendered with the cached snapshot, so data shows before JavaScript loads.

The API can't act as a proxy. It ignores request input, its upstream parameters are fixed in code, and it serves only ids already in the cached top 50.

## Categories and brand colours

Both are product decisions, so they live in a typed module ([`asset-metadata.ts`](src/shared/asset-metadata.ts)) keyed by CoinGecko id, because symbols collide. They change through code review: a CMS would be overkill for about 50 rows that rarely change.

- **Provenance:** each colour records its source: a published brand colour, or one sampled from the logo.
- **Contrast:** the server adjusts pale colours to reach WCAG's 3:1 ratio for graphics. Accents are used for rings and chart lines, never for text.
- **Joining:** metadata is joined on every read, so editing it never requires refetching prices.
- **Unknown coins:** a new top-50 coin falls back to category C and neutral grey. `pnpm check:metadata` lists any gaps.

## Fetching, caching and freshness

- **Markets:** one call, `/coins/markets?per_page=50&sparkline=true`, also returns the 7-day series for the charts, at no extra quota.
- **Rates:** `/simple/price` for Bitcoin in USD, EUR and GBP, refreshed every 2 hours, gives exchange rates and their own 24h move. EUR and GBP 24h changes are restated as `(1 + changeUsd) × (1 + rateChange) − 1`, never reused from USD.
- **Cache:** an in-process stale-while-revalidate cache.
  - Data is served from memory for 5 minutes. After that, the next request triggers a single background refresh that all callers share.
  - Failures keep the last good data and back off from 15 s up to 5 min, honouring `Retry-After`.
  - On a cold start during an outage, requests get a 503 without calling upstream again.
  - Past 3 intervals old, a request waits up to 3 s for fresh data rather than serving stale data.
  - A snapshot with under 90% of assets priced is rejected, so a systemic upstream change can't hide behind a page of dashes.
- **Age:** clients compute age from server timestamps, so a wrong client clock can't make old data look fresh.
- **Status:** **Up to date** until 6.5 min, **Delayed** until 15 min, then **Stale**, with the cause shown.

## API usage for 500 concurrent users

Upstream calls scale with time, not users: each server process makes at most one call per cache interval.

|                                                    | Calculation                | Result                              |
| -------------------------------------------------- | -------------------------- | ----------------------------------- |
| Markets                                            | 31 days × 24 × 60 / 5 min  | 8,928 / month                       |
| Rates                                              | 31 × 24 / 2 h              | 372 / month                         |
| **Total (worst case: traffic all day, every day)** |                            | **9,300 / month (93% of 10,000)**   |
| Per minute                                         | steady state / worst burst | ~0.21 / ≤ 6, against a limit of 100 |
| Our server                                         | 500 users / 30 s poll      | ~17 req/s, served from memory       |

The **monthly quota** is the binding limit. A 4-minute refresh (11,160) or native EUR/GBP markets (×3) would exceed it. The server warns at startup if its configuration could. When the quota is exhausted, retries continue every 5 minutes; failed calls use no credits. Users see the cause and the data's age.

## Correctness, failures and testing

- A non-zero price never shows as `$0.00`, and missing values show "—", never 0.
- Colour and direction follow the _rounded_ change.
- Category 24h change is computed from combined value, not averaged percentages.
- Values are converted before sorting and totals, so everything on screen agrees.
- The client never replaces a snapshot with an older one, and reports being offline as offline.

The Vitest suite targets where bugs cost money: formatting, conversion maths, the quota projection, and cache behaviour on a fake clock. It also runs the real route handlers against a mocked CoinGecko, checking that 500 requests make 1 upstream call, the key never leaks, and outages, 429s, timeouts and bad payloads are handled. Component tests cover polling, stale and offline states, and the currency fallback.

## Deliberately not built

- **Global market stats:** a third endpoint would push usage over the quota. Category totals reuse data we already have.
- **WebSockets:** upstream data changes every 5 minutes, so polling is simpler and looks the same to users.
- **A metadata database:** see above.
- **Rate limiting our API:** it never generates upstream load. In production that belongs at the edge.

## First production improvements

1. **Shared cache:** N instances multiply upstream usage by N, so move snapshots to Redis behind one scheduled poller.
2. **Alerting:** alert on refresh failures, snapshot age and quota burn (CoinGecko's `/key` endpoint).
3. **End-to-end tests:** Playwright for the stale and outage paths.

## AI tools

Built with an AI coding assistant (Claude Code), which drafted code, tests and docs from my direction. I reviewed the results and verified them with the test suite, the production build and the app in a browser.
