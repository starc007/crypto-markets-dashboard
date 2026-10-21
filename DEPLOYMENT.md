# Deployment

The app is built for **one long-running Node process** (`pnpm build && pnpm start`, a Docker container, or a host like Railway, Fly or Render). That works today with no changes: set `COINGECKO_API_KEY` and run **exactly one instance**.

Serverless and edge platforms break three assumptions the code makes. This document explains what changes, where, and why, for Vercel and for Cloudflare.

## The three assumptions

| #   | Assumption today                                                                     | Where                                                                                                                                                   | Why it breaks on serverless                                                                                               |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | One process holds the cache, so there is one in-flight request and one backoff timer | `globalStore.__marketsSource` in [`src/server/markets.ts`](src/server/markets.ts)                                                                       | Each instance has its own memory, so N instances can make N× the upstream calls and break the 9,300-calls-a-month budget  |
| 2   | Background work keeps running after the response is sent                             | `void refresh()` in [`src/server/cache/swr-cache.ts`](src/server/cache/swr-cache.ts)                                                                    | The platform can freeze the function as soon as it responds, so the refresh may never finish                              |
| 3   | Every request reaches our server, which is cheap                                     | `Cache-Control: no-store` in [`src/server/http.ts`](src/server/http.ts); 30 s polling in [`src/hooks/use-market-data.ts`](src/hooks/use-market-data.ts) | 500 users × 2 polls a minute ≈ 43M requests a month. That's free on one server but counts against platform request limits |

Whatever the platform, the fix is the same idea: **one shared snapshot, exactly one writer, and a cache in front of it.**

## Changes common to both platforms

These keep the caching rules we already have (TTL, backoff, `Retry-After`, never overwriting good data) and change only where the state lives.

1. **A `SnapshotStore` interface** (new, `src/server/store/`):
   - `read`, `write` and `tryLock(key, ttl)`.
   - The in-memory implementation stays for local development and tests, so the existing mocked-CoinGecko tests keep working unchanged.
2. **Cache state moves into the store** ([`swr-cache.ts`](src/server/cache/swr-cache.ts)):
   - The snapshot, `fetchedAt`, the last failure and `retryAt` are stored together, so every instance respects the same backoff.
   - Each instance keeps the snapshot it read until it expires. Nothing newer can exist before then, so the store is read about once per refresh interval per instance, not on every request.
3. **Serialisable snapshots** ([`src/server/coingecko/schema.ts`](src/server/coingecko/schema.ts)):
   - `sparklines` changes from a `Map` to a plain object.
   - Keys carry a version (`markets:v1`), so a deploy that changes the shape doesn't read old data.
4. **CDN caching of API responses** ([`src/server/http.ts`](src/server/http.ts)):
   - Successful responses are cacheable at the CDN for about 30 s. Browsers still don't cache them, and error responses stay `no-store`.
   - This collapses 500 users into a few origin calls a minute.
5. **Age-aware freshness** ([`src/lib/api-client.ts`](src/lib/api-client.ts)):
   - A CDN-cached body has an old `generatedAt`, so the client subtracts the HTTP `Age` header from `receivedAt`.
   - Without this, the freshness badge would understate how old the data is.
6. **Polling aligned to refreshes** ([`src/hooks/use-market-data.ts`](src/hooks/use-market-data.ts)):
   - Clients poll a few seconds (with random jitter) after the next expected refresh, using `fetchedAt + refreshIntervalMs`, instead of every 30 s.
   - That's about 10× fewer requests, with no added delay in what users see.
7. **Environment isolation:** preview deployments must not spend production quota. They read the production snapshot read-only, or use their own key.

## Vercel

Vercel runs the app as serverless functions behind its CDN.

```
Browser ─▶ Vercel CDN (≈30 s) ─▶ /api/markets ─▶ instance memo ─▶ Upstash Redis ◀─ single writer ─▶ CoinGecko
```

**Store:** [Upstash Redis](https://upstash.com/pricing/redis) from the Vercel Marketplace. It uses a REST client, so it works from functions without connection pooling. Put the database in the same region as your functions.

**Who refreshes depends on the plan:**

| Plan      | Refresh mechanism                                                                                                                                                                                                                                                             | Monthly upstream calls               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Hobby** | Cron jobs run [at most once a day](https://vercel.com/docs/cron-jobs/usage-and-pricing), so: the first request to see expired data takes a Redis lock (`SET key NX PX 20000`) and refreshes inside `after()` from `next/server`. Everyone else keeps getting the cached data. | ≤ 9,300, fewer when traffic is quiet |
| **Pro**   | Vercel Cron calls `/api/cron/refresh` (protected by `CRON_SECRET`) every 5 min for markets and every 2 h for rates. User requests never call CoinGecko.                                                                                                                       | Exactly 9,300                        |

**Files to add or change:**

| File                                                                                                   | Change                                                                     | Why                                |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------- |
| `src/server/store/redis-store.ts` (new)                                                                | `SnapshotStore` backed by `@upstash/redis`                                 | Shared state across instances      |
| [`src/server/markets.ts`](src/server/markets.ts)                                                       | Pick the Redis or memory store from env; schedule refreshes with `after()` | Assumptions 1 and 2                |
| `src/app/api/cron/refresh/route.ts` (new, Pro only)                                                    | Runs a refresh; checks `Authorization: Bearer $CRON_SECRET`                | Fixed, traffic-independent refresh |
| `vercel.json` (new, Pro only)                                                                          | `crons` entries                                                            | Schedules the job                  |
| [`src/server/http.ts`](src/server/http.ts)                                                             | CDN caching headers on successes                                           | Assumption 3                       |
| [`src/lib/api-client.ts`](src/lib/api-client.ts), [`use-market-data.ts`](src/hooks/use-market-data.ts) | `Age` handling and aligned polling                                         | Honest freshness, fewer requests   |

**Environment variables:**

| Variable                                                | Notes                                             |
| ------------------------------------------------------- | ------------------------------------------------- |
| `COINGECKO_API_KEY`                                     | Server-only. Never prefix it with `NEXT_PUBLIC_`. |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | Added by the Marketplace integration              |
| `CRON_SECRET`                                           | Pro only                                          |

**Things to watch:**

- **CDN caching is per region:** without the shared store behind it, each region would refresh separately. Responses that set a cookie aren't cached, so keep the API cookie-free; the currency cookie is only read by pages.
- **`use cache: remote` is not a substitute on its own:** on Vercel it uses a regional, evictable Runtime Cache. It doesn't guarantee a single refresh across instances, has no backoff during outages, and doesn't survive deploys.
- **Upstash free tier:** 500K commands and 10 GB of bandwidth a month. The per-instance memo keeps us well inside this. Paid usage is about $0.20 per 100K commands.
- **Vercel's own request limits:** included requests and function invocations depend on the plan and apply even with perfect caching. Aligned polling is what keeps 500 always-on users realistic; check your plan's numbers.

## Cloudflare

Cloudflare runs Next.js on Workers through the [OpenNext adapter](https://opennext.js.org/cloudflare). The natural fit for our design is a **Durable Object**: a single object with its own state, of which Cloudflare guarantees only one copy exists worldwide.

```
Browser ─▶ Worker (Next.js via OpenNext) ─▶ MarketsSnapshot Durable Object ─▶ CoinGecko
                                               ▲ alarm every 5 min / 2 h
```

**Why a Durable Object:**

- It replaces both Redis and the lock. Every request for the snapshot is routed to that one object, so there is one cache, one in-flight request and one backoff timer, the same guarantees as our single Node process today.
- Its alarm schedules refreshes, so no request ever has to trigger one.
- Its built-in storage persists snapshots across restarts and deploys.

**Files to add or change:**

| File                                                                                                                                       | Change                                                                                                                                                                                   | Why                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `wrangler.jsonc` (new)                                                                                                                     | Durable Object binding and migration, compatibility flags, the OpenNext build output                                                                                                     | Platform configuration                      |
| `open-next.config.ts` (new)                                                                                                                | OpenNext adapter configuration                                                                                                                                                           | Builds Next.js for Workers                  |
| `src/server/durable/markets-snapshot.ts` (new)                                                                                             | Durable Object class that reuses [`client.ts`](src/server/coingecko/client.ts), [`schema.ts`](src/server/coingecko/schema.ts) and the backoff rules; `alarm()` refreshes and reschedules | Single writer, scheduled refresh            |
| [`src/server/markets.ts`](src/server/markets.ts)                                                                                           | Read the snapshot from the Durable Object stub instead of the in-process cache                                                                                                           | Assumption 1                                |
| [`src/server/http.ts`](src/server/http.ts), [`api-client.ts`](src/lib/api-client.ts), [`use-market-data.ts`](src/hooks/use-market-data.ts) | Same CDN, `Age` and polling changes as Vercel                                                                                                                                            | Assumption 3                                |
| [`next.config.ts`](next.config.ts)                                                                                                         | Image optimisation through Cloudflare Images, or `unoptimized` logos                                                                                                                     | `next/image` needs a platform image service |

**Secrets:** `wrangler secret put COINGECKO_API_KEY`.

**Things to watch:**

- **Avoid Workers KV and the Cache API as the source of truth:** KV is eventually consistent and can't act as a lock, and the Cache API is per data centre. Both would multiply upstream calls. They're fine as a short-lived read cache in front of the Durable Object.
- **Check what the adapter supports before migrating:** this app uses Cache Components, partial prerendering and `connection()`, so confirm the OpenNext adapter's support for those.
- **Route handlers have no Node-only dependencies**, but run the test suite under the Workers runtime (or Miniflare) once.

## Which to choose

- **Simplest:** one Node container. No code changes, and the quota maths in [DECISIONS.md](DECISIONS.md) holds exactly.
- **Vercel:** Redis plus a lock on Hobby, or cron on Pro. Moderate changes, and it relies on two external services.
- **Cloudflare:** a Durable Object maps most directly onto the current design and needs no extra services. The main risk is adapter support for Next.js 16 features.
