"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createConverter, type CurrencyConverter } from "@/lib/currency-conversion";
import { CURRENCY_COOKIE, isCurrency, type Currency, type FxSnapshot } from "@/shared/currency";

/*
 * The preference lives in a cookie rather than localStorage so the server can
 * render the chosen currency directly, with no flash of USD after hydration.
 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const listeners = new Set<() => void>();

function readCookie(): Currency | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CURRENCY_COOKIE}=([^;]*)`));
  const value = match?.[1];
  return isCurrency(value) ? value : null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCurrencyPreference(initial: Currency) {
  const stored = useSyncExternalStore(subscribe, readCookie, () => null);

  const setCurrency = useCallback((currency: Currency) => {
    document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    listeners.forEach((l) => l());
  }, []);

  return { currency: stored ?? initial, setCurrency };
}

export interface DisplayCurrency {
  converter: CurrencyConverter;
  /** The viewer's choice, which may differ from `converter.currency` when rates are missing. */
  requested: Currency;
  fellBack: boolean;
}

/** Falls back to USD, and says so, when rates for the chosen currency are unavailable. */
export function useDisplayCurrency(requested: Currency, fx: FxSnapshot | null): DisplayCurrency {
  return useMemo(() => {
    const converter = createConverter(requested, fx);
    return converter
      ? { converter, requested, fellBack: false }
      : { converter: createConverter("USD", null)!, requested, fellBack: true };
  }, [requested, fx]);
}
