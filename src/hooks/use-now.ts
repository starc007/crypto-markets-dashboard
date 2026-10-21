"use client";

import { useSyncExternalStore } from "react";

/*
 * One shared ticking clock for every component that shows a relative time.
 * The interval only runs while something is subscribed.
 */
const TICK_MS = 1_000;
const listeners = new Set<() => void>();
/** Null until the first subscriber starts the clock; snapshots must be stable between ticks. */
let current: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      current = null;
    }
  };
}

function getSnapshot() {
  return current;
}

/** Null during server rendering and hydration, so relative times never mismatch. */
function getServerSnapshot() {
  return null;
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
