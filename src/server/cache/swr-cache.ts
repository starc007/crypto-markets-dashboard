/**
 * A single-entry, in-process stale-while-revalidate cache.
 *
 * Guarantees, regardless of how many callers there are:
 * - At most one upstream call is in flight (concurrent callers share it).
 * - No upstream call happens while the value is younger than `ttlMs`.
 * - After a failure, no upstream call happens until the retry delay elapses,
 *   even when there is no value to serve. This stops a cold start during an
 *   outage from turning every incoming request into an upstream request.
 * - A failed refresh never discards the last good value.
 *
 * Callers receive `fetchedAt` and the last failure with every read, so they
 * can tell users exactly how old the data is.
 */

export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

export interface CacheFailure<E> {
  error: E;
  at: number;
  retryAt: number;
  consecutiveFailures: number;
}

export interface CacheRead<T, E> extends CacheEntry<T> {
  /** Present when the latest refresh failed; cleared by the next success. */
  failure: CacheFailure<E> | null;
}

export interface SwrCacheOptions<T, E> {
  fetcher: () => Promise<T>;
  ttlMs: number;
  /** Delay before retrying after the n-th consecutive failure (n starts at 1). */
  retryDelayMs: (error: E, consecutiveFailures: number) => number;
  /** Converts whatever the fetcher threw into the cache's error type. */
  toError: (thrown: unknown) => E;
  now?: () => number;
}

export class CacheEmptyError<E> extends Error {
  constructor(readonly failure: CacheFailure<E>) {
    super("No cached value is available and the last refresh failed");
    this.name = "CacheEmptyError";
  }
}

export interface SwrCache<T, E> {
  /** Returns the current value, waiting only when there is nothing cached yet. */
  get(): Promise<CacheRead<T, E>>;
  /** Resolves once any in-flight refresh has settled. */
  settled(): Promise<void>;
}

export function createSwrCache<T, E>(options: SwrCacheOptions<T, E>): SwrCache<T, E> {
  const now = options.now ?? Date.now;
  let entry: CacheEntry<T> | null = null;
  let failure: CacheFailure<E> | null = null;
  let inFlight: Promise<void> | null = null;

  function refresh(): Promise<void> {
    inFlight ??= options
      .fetcher()
      .then(
        (value) => {
          entry = { value, fetchedAt: now() };
          failure = null;
        },
        (thrown: unknown) => {
          const error = options.toError(thrown);
          const consecutiveFailures = (failure?.consecutiveFailures ?? 0) + 1;
          const at = now();
          failure = {
            error,
            at,
            consecutiveFailures,
            retryAt: at + options.retryDelayMs(error, consecutiveFailures),
          };
        },
      )
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  function canAttempt(): boolean {
    return failure === null || now() >= failure.retryAt;
  }

  function read(current: CacheEntry<T>): CacheRead<T, E> {
    return { ...current, failure };
  }

  return {
    async get() {
      if (entry === null) {
        if (inFlight) await inFlight;
        else if (canAttempt()) await refresh();
        if (entry === null) throw new CacheEmptyError(failure!);
        return read(entry);
      }

      const isExpired = now() - entry.fetchedAt >= options.ttlMs;
      if (isExpired && !inFlight && canAttempt()) {
        // Serve what we have immediately; the refresh lands for later callers.
        void refresh();
      }
      return read(entry);
    },

    async settled() {
      await inFlight;
    },
  };
}
