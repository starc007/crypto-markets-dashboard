"use client";

import { useNow } from "@/hooks/use-now";
import type { DisplayCurrency } from "@/hooks/use-currency";
import { formatRelativeAge } from "@/lib/format";
import { CURRENCIES, type Currency, type FxSnapshot } from "@/shared/currency";
import { Tabs, type TabOption } from "../ui/tabs";

const CURRENCY_NAMES: Record<Currency, string> = {
  USD: "US dollar",
  EUR: "Euro",
  GBP: "British pound",
};

interface CurrencySwitcherProps {
  value: Currency;
  onChange: (currency: Currency) => void;
  fx: FxSnapshot | null;
}

export function CurrencySwitcher({ value, onChange, fx }: CurrencySwitcherProps) {
  const options: TabOption<Currency>[] = CURRENCIES.map((currency) => ({
    value: currency,
    label: currency,
    description: CURRENCY_NAMES[currency],
    // Without rates we can't convert, so only USD stays selectable.
    disabled: currency !== "USD" && !fx?.rates[currency],
  }));
  return <Tabs label="Currency" options={options} value={value} onChange={onChange} />;
}

const rateFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/** States how non-USD values were derived, so converted numbers are never presented as native quotes. */
export function ConversionNote({
  display,
  fx,
}: {
  display: DisplayCurrency;
  fx: FxSnapshot | null;
}) {
  const now = useNow();
  const { converter, requested, fellBack } = display;

  if (fellBack) {
    return (
      <p className="text-xs text-warn">
        {CURRENCY_NAMES[requested]} rates are unavailable right now, so values are shown in USD.
      </p>
    );
  }
  if (!converter.rate || !fx) return null;

  const symbol = new Intl.NumberFormat("en-US", { style: "currency", currency: converter.currency })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value;

  return (
    <p className="text-xs text-muted">
      Converted from USD at 1 USD = {symbol}
      {rateFormat.format(converter.rate.perUsd)}
      {now !== null && <> · rate updated {formatRelativeAge(now - Date.parse(fx.fetchedAt))}</>}
    </p>
  );
}
