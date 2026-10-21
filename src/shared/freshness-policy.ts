/**
 * Freshness thresholds shared by the server (when to stop serving cached data
 * unrefreshed) and the client (what to call it). Keeping them in one place
 * keeps the two from disagreeing about what "stale" means.
 */

/** Normal worst-case age is one refresh interval plus a client poll and some slack. */
export const LIVE_GRACE_MS = 90_000;

/** Beyond this many refresh intervals, data is stale. */
export const STALE_AFTER_INTERVALS = 3;
