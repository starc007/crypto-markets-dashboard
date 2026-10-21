import { CacheEmptyError, createSwrCache } from "./swr-cache";

const TTL = 300_000;

class FetchError extends Error {
  constructor(readonly retryAfterMs?: number) {
    super("upstream failed");
  }
}

function setup(extra: { maxStaleMs?: number; maxStaleWaitMs?: number } = {}) {
  let clock = 1_000_000;
  const fetcher = vi.fn<() => Promise<string>>();
  const cache = createSwrCache<string, FetchError>({
    fetcher,
    ttlMs: TTL,
    ...extra,
    now: () => clock,
    toError: (e) => (e instanceof FetchError ? e : new FetchError()),
    retryDelayMs: (error, n) => Math.max(error.retryAfterMs ?? 0, 10_000 * 2 ** (n - 1)),
  });
  return {
    cache,
    fetcher,
    advance: (ms: number) => {
      clock += ms;
    },
    now: () => clock,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createSwrCache", () => {
  it("shares one upstream request between concurrent cold-start callers", async () => {
    const { cache, fetcher } = setup();
    const pending = deferred<string>();
    fetcher.mockReturnValueOnce(pending.promise);

    const reads = Array.from({ length: 500 }, () => cache.get());
    pending.resolve("v1");

    const results = await Promise.all(reads);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((r) => r.value))).toEqual(new Set(["v1"]));
  });

  it("serves fresh values from memory without calling upstream", async () => {
    const { cache, fetcher, advance } = setup();
    fetcher.mockResolvedValue("v1");
    await cache.get();

    advance(TTL - 1);
    await Promise.all(Array.from({ length: 100 }, () => cache.get()));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serves the stale value immediately and refreshes once in the background", async () => {
    const { cache, fetcher, advance, now } = setup();
    fetcher.mockResolvedValueOnce("v1");
    const first = await cache.get();

    advance(TTL);
    const pending = deferred<string>();
    fetcher.mockReturnValueOnce(pending.promise);

    const staleReads = await Promise.all(Array.from({ length: 50 }, () => cache.get()));
    expect(staleReads.every((r) => r.value === "v1" && r.fetchedAt === first.fetchedAt)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);

    pending.resolve("v2");
    await cache.settled();
    const fresh = await cache.get();
    expect(fresh.value).toBe("v2");
    expect(fresh.fetchedAt).toBe(now());
  });

  it("keeps the last good value and reports the failure when a refresh fails", async () => {
    const { cache, fetcher, advance } = setup();
    fetcher.mockResolvedValueOnce("v1");
    await cache.get();

    advance(TTL);
    fetcher.mockRejectedValueOnce(new FetchError());
    await cache.get();
    await cache.settled();

    const read = await cache.get();
    expect(read.value).toBe("v1");
    expect(read.failure).toMatchObject({ consecutiveFailures: 1 });
  });

  it("does not retry before the backoff delay, then clears the failure on success", async () => {
    const { cache, fetcher, advance } = setup();
    fetcher.mockResolvedValueOnce("v1");
    await cache.get();

    advance(TTL);
    fetcher.mockRejectedValueOnce(new FetchError());
    await cache.get();
    await cache.settled();
    expect(fetcher).toHaveBeenCalledTimes(2);

    advance(9_999);
    await Promise.all(Array.from({ length: 20 }, () => cache.get()));
    expect(fetcher).toHaveBeenCalledTimes(2);

    advance(1);
    fetcher.mockResolvedValueOnce("v2");
    await cache.get();
    await cache.settled();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(await cache.get()).toMatchObject({ value: "v2", failure: null });
  });

  it("backs off exponentially across consecutive failures", async () => {
    const { cache, fetcher, advance } = setup();
    fetcher.mockResolvedValueOnce("v1");
    await cache.get();
    fetcher.mockRejectedValue(new FetchError());

    advance(TTL);
    await cache.get();
    await cache.settled();
    advance(10_000);
    await cache.get();
    await cache.settled();

    const read = await cache.get();
    expect(read.failure).toMatchObject({ consecutiveFailures: 2 });
    expect(read.failure!.retryAt - read.failure!.at).toBe(20_000);
  });

  it("honours an upstream Retry-After that is longer than the backoff", async () => {
    const { cache, fetcher, advance } = setup();
    fetcher.mockRejectedValueOnce(new FetchError(120_000));
    await expect(cache.get()).rejects.toBeInstanceOf(CacheEmptyError);

    advance(60_000);
    await expect(cache.get()).rejects.toBeInstanceOf(CacheEmptyError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails fast without calling upstream when empty and in backoff", async () => {
    const { cache, fetcher } = setup();
    fetcher.mockRejectedValueOnce(new FetchError());
    await expect(cache.get()).rejects.toBeInstanceOf(CacheEmptyError);

    const results = await Promise.allSettled(Array.from({ length: 500 }, () => cache.get()));
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects every concurrent cold-start caller when the shared request fails", async () => {
    const { cache, fetcher } = setup();
    const pending = deferred<string>();
    fetcher.mockReturnValueOnce(pending.promise);

    const reads = Array.from({ length: 10 }, () => cache.get());
    pending.reject(new FetchError());

    const results = await Promise.allSettled(reads);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("waits for the refresh instead of serving data older than maxStaleMs", async () => {
    const { cache, fetcher, advance } = setup({ maxStaleMs: 3 * TTL });
    fetcher.mockResolvedValueOnce("v1");
    await cache.get();

    advance(3 * TTL);
    fetcher.mockResolvedValueOnce("v2");
    expect((await cache.get()).value).toBe("v2");
  });

  it("falls back to the old value if that refresh is too slow", async () => {
    const { cache, fetcher, advance } = setup({ maxStaleMs: 3 * TTL, maxStaleWaitMs: 20 });
    fetcher.mockResolvedValueOnce("v1");
    await cache.get();

    advance(3 * TTL);
    fetcher.mockReturnValueOnce(new Promise(() => {}));
    expect((await cache.get()).value).toBe("v1");
  });
});
