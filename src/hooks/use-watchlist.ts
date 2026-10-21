"use client";

import { useCallback, useSyncExternalStore } from "react";
import { z } from "zod";

/**
 * A watchlist persisted in localStorage and kept in sync across tabs. It is
 * per-device by design: there are no user accounts to attach it to.
 */
export const WATCHLIST_STORAGE_KEY = "markets.watchlist.v1";

const storedSchema = z.array(z.string()).max(500);
const EMPTY: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedSet: ReadonlySet<string> = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
  } catch {
    return null; // Storage can be disabled (privacy modes, quotas).
  }
}

function getSnapshot(): ReadonlySet<string> {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    const parsed = raw ? storedSchema.safeParse(safeJsonParse(raw)) : null;
    cachedSet = parsed?.success ? new Set(parsed.data) : EMPTY;
  }
  return cachedSet;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === WATCHLIST_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Storage is unavailable; the watchlist stays as it was.
  }
  listeners.forEach((l) => l());
}

export function useWatchlist() {
  const watchlist = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const toggle = useCallback((id: string) => {
    const next = new Set(getSnapshot());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    write(next);
  }, []);

  return { watchlist, toggle };
}
