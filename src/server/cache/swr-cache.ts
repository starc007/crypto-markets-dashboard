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
 * - Past `maxStaleMs`, a caller waits (up to `maxStaleWaitMs`) for the refresh
 *   instead of being handed very old data, e.g. the first visitor after a
 *   quiet night. If the refresh is slow or failing, they still get the old
 *   value, clearly dated.
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
  /** Age beyond which a read waits for the refresh rather than serving stale data. */
  maxStaleMs?: number;
  /** Longest a read waits for that refresh. Defaults to 3 seconds. */
  maxStaleWaitMs?: number;
  now?: () => number;
}

export class CacheEmptyError<E> extends Error {
  constructor(readonly failure: CacheFailure<E>) {
    super("No cached value is available and the last refresh failed");
    this.name = "CacheEmptyError";
  }
}

export interface SwrCache<T, E> {
  /** Returns the current value, waiting only when there is nothing cached or it is very stale. */
  get(): Promise<CacheRead<T, E>>;
  /** Resolves once any in-flight refresh has settled. */
  settled(): Promise<void>;
}

const DEFAULT_MAX_STALE_WAIT_MS = 3_000;

/** Resolves when `promise` settles or after `ms`, whichever comes first. */
async function waitAtMost(promise: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    promise,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]);
  clearTimeout(timer);
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

      const age = now() - entry.fetchedAt;
      if (age >= options.ttlMs && (inFlight || canAttempt())) {
        const pending = inFlight ?? refresh();
        if (options.maxStaleMs !== undefined && age >= options.maxStaleMs) {
          await waitAtMost(pending, options.maxStaleWaitMs ?? DEFAULT_MAX_STALE_WAIT_MS);
        }
        // Otherwise serve what we have immediately; the refresh lands for later callers.
      }
      return read(entry);
    },

    async settled() {
      await inFlight;
    },
  };
}
