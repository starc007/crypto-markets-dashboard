"use client";

import { ApiError } from "@/lib/api-client";
import { formatDuration } from "@/lib/format";
import { AlertIcon } from "./icons";

function describe(error: Error | null): { title: string; detail: string } {
  if (error instanceof ApiError) {
    const retry = error.retryAfterSeconds
      ? ` The server will retry in about ${formatDuration(error.retryAfterSeconds * 1000)}.`
      : "";
    switch (error.code) {
      case "NETWORK":
        return {
          title: "You appear to be offline",
          detail: "Check your connection and try again.",
        };
      case "RATE_LIMITED":
        return {
          title: "Market data is temporarily unavailable",
          detail: `Our data provider is limiting requests.${retry}`,
        };
      case "NOT_FOUND":
        return { title: "Not found", detail: error.message };
      default:
        return {
          title: "Market data is temporarily unavailable",
          detail: `${error.message}${retry}`,
        };
    }
  }
  return { title: "Something went wrong", detail: "Please try again." };
}

/** Shown only when there is no data at all; with older data we show it and warn instead. */
export function ErrorState({
  error,
  onRetry,
  retrying,
}: {
  error: Error | null;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { title, detail } = describe(error);
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-danger-border bg-danger-bg px-6 py-12 text-center text-danger"
    >
      <AlertIcon className="size-6" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm">{detail}</p>
        <p className="mt-1 text-sm">
          No prices are shown because we have no data we can vouch for.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="rounded-lg border border-danger-border bg-surface px-3 py-1.5 text-sm text-fg disabled:opacity-60"
      >
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}
