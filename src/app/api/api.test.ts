/**
 * Integration tests: real route handlers, real cache and real CoinGecko client,
 * with only the network mocked (MSW) and the clock controlled.
 */
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { buildMarketsUrl } from "@/server/coingecko/client";
import { createMarketsSource, setMarketsSourceForTesting } from "@/server/markets";
import type { ApiErrorBody, CoinDetailResponse, MarketsResponse } from "@/shared/market";
import fixture from "@/test/fixtures/coingecko-markets.json";
import { GET as getCoin } from "./coins/[id]/route";
import { GET as getMarkets } from "./markets/route";

vi.mock("next/server", () => ({ connection: async () => {} }));

const API_KEY = "test-demo-key";
const REFRESH_MS = 300_000;
const UPSTREAM = buildMarketsUrl();

const upstream = {
  calls: [] as Request[],
  respond: (): Response | Promise<Response> => HttpResponse.json(fixture),
};

const server = setupServer(
  http.get(`${UPSTREAM.origin}${UPSTREAM.pathname}`, ({ request }) => {
    upstream.calls.push(request);
    return upstream.respond();
  }),
);

let clock: number;
const advance = (ms: number) => {
  clock += ms;
  vi.setSystemTime(clock);
};

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  clock = Date.parse("2026-01-01T12:00:00.000Z");
  vi.setSystemTime(clock);
  upstream.calls = [];
  upstream.respond = () => HttpResponse.json(fixture);
  setMarketsSourceForTesting(
    createMarketsSource({ apiKey: API_KEY, refreshIntervalMs: REFRESH_MS }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setMarketsSourceForTesting(undefined);
  vi.useRealTimers();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const coinRequest = (id: string) =>
  getCoin(new Request(`http://localhost/api/coins/${id}`), {
    params: Promise.resolve({ id }),
  } as RouteContext<"/api/coins/[id]">);

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("GET /api/markets", () => {
  it("serves many concurrent users from a single upstream request", async () => {
    const responses = await Promise.all(Array.from({ length: 500 }, () => getMarkets()));

    expect(upstream.calls).toHaveLength(1);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    const body = await json<MarketsResponse>(responses[0]!);
    expect(body.coins).toHaveLength(50);
  });

  it("joins market data with application metadata", async () => {
    const body = await json<MarketsResponse>(await getMarkets());
    const btc = body.coins.find((c) => c.id === "bitcoin")!;
    expect(btc).toMatchObject({
      category: "A",
      hasCuratedMetadata: true,
      accent: { brand: "#F7931A" },
    });
    expect(new Set(body.coins.map((c) => c.category))).toEqual(new Set(["A", "B", "C"]));
  });

  it("sends the API key upstream but never to the browser", async () => {
    const response = await getMarkets();
    expect(upstream.calls[0]!.headers.get("x-cg-demo-api-key")).toBe(API_KEY);
    expect(await response.text()).not.toContain(API_KEY);
    expect([...response.headers.values()].join(" ")).not.toContain(API_KEY);
  });

  it("uses fixed upstream parameters and is not cacheable by shared caches", async () => {
    const response = await getMarkets();
    expect(new URL(upstream.calls[0]!.url).search).toBe(UPSTREAM.search);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports data age from the server's clock", async () => {
    await getMarkets();
    advance(120_000);
    const { meta } = await json<MarketsResponse>(await getMarkets());
    expect(Date.parse(meta.generatedAt) - Date.parse(meta.fetchedAt)).toBe(120_000);
    expect(meta.refreshIntervalMs).toBe(REFRESH_MS);
  });

  it("refreshes at most once per interval, serving cached data meanwhile", async () => {
    await getMarkets();
    for (let i = 0; i < 10; i++) {
      advance(REFRESH_MS / 10 - 1);
      await getMarkets();
    }
    expect(upstream.calls).toHaveLength(1);

    advance(REFRESH_MS);
    await Promise.all(Array.from({ length: 100 }, () => getMarkets()));
    await settle();
    expect(upstream.calls).toHaveLength(2);
  });

  it("keeps serving the last good data when CoinGecko rate limits us", async () => {
    await getMarkets();
    advance(REFRESH_MS);
    upstream.respond = () =>
      new HttpResponse(null, { status: 429, headers: { "Retry-After": "600" } });

    await getMarkets(); // triggers the failing background refresh
    await settle();
    await settle();

    const response = await getMarkets();
    const body = await json<MarketsResponse>(response);
    expect(response.status).toBe(200);
    expect(body.coins).toHaveLength(50);
    expect(body.meta.lastRefreshFailure).toMatchObject({ code: "RATE_LIMITED" });
    expect(Date.parse(body.meta.lastRefreshFailure!.retryAt) - clock).toBe(600_000);

    // No more upstream calls until Retry-After has passed, however many users ask.
    await Promise.all(Array.from({ length: 100 }, () => getMarkets()));
    advance(599_000);
    await getMarkets();
    await settle();
    expect(upstream.calls).toHaveLength(2);
  });

  it("does not replace good data with an empty or malformed response", async () => {
    await getMarkets();
    advance(REFRESH_MS);
    upstream.respond = () => HttpResponse.json([]);
    await getMarkets();
    await settle();
    await settle();

    const body = await json<MarketsResponse>(await getMarkets());
    expect(body.coins).toHaveLength(50);
    expect(body.meta.lastRefreshFailure?.code).toBe("INVALID_RESPONSE");
  });

  it("returns 503 with Retry-After on a cold start during an outage, without hammering upstream", async () => {
    upstream.respond = () => new HttpResponse("upstream down", { status: 502 });

    const response = await getMarkets();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("15");
    const body = await json<ApiErrorBody>(response);
    expect(body.error.code).toBe("UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("upstream down");

    const retries = await Promise.all(Array.from({ length: 200 }, () => getMarkets()));
    expect(retries.every((r) => r.status === 503)).toBe(true);
    expect(upstream.calls).toHaveLength(1);
  });

  it("recovers on the first successful refresh after an outage", async () => {
    upstream.respond = () => new HttpResponse(null, { status: 500 });
    expect((await getMarkets()).status).toBe(503);

    advance(15_000);
    upstream.respond = () => HttpResponse.json(fixture);
    const body = await json<MarketsResponse>(await getMarkets());
    expect(body.coins).toHaveLength(50);
    expect(body.meta.lastRefreshFailure).toBeNull();
  });

  it("treats a hanging upstream as a timeout", async () => {
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(20));
    upstream.respond = async () => {
      await delay("infinite");
      return HttpResponse.json(fixture);
    };
    const body = await json<ApiErrorBody>(await getMarkets());
    expect(body.error.code).toBe("TIMEOUT");
  });
});

describe("GET /api/coins/[id]", () => {
  it("serves detail and 7-day history from the shared snapshot", async () => {
    await getMarkets();
    const response = await coinRequest("ethereum");
    const body = await json<CoinDetailResponse>(response);

    expect(response.status).toBe(200);
    expect(body.coin.id).toBe("ethereum");
    expect(body.sparkline7d!.length).toBeGreaterThan(2);
    expect(upstream.calls).toHaveLength(1);
  });

  it("returns 404 for assets outside the top 50 without calling upstream", async () => {
    await getMarkets();
    const response = await coinRequest("some-unlisted-token");
    expect(response.status).toBe(404);
    expect(upstream.calls).toHaveLength(1);
  });

  it("rejects malformed ids before touching the cache", async () => {
    const response = await coinRequest("../../exchanges");
    expect(response.status).toBe(400);
    expect(upstream.calls).toHaveLength(0);
  });
});
