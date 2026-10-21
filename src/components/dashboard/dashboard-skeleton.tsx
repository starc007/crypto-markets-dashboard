const ROWS = [0, 1, 2, 3, 4, 5];

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Loading market data…</span>
      <div className="h-5 w-48 animate-pulse rounded bg-surface-muted" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-surface-muted md:w-96" />
      {["A", "B", "C"].map((id) => (
        <div key={id} className="rounded-xl border border-border bg-surface p-4" aria-hidden="true">
          <div className="mb-4 h-5 w-56 animate-pulse rounded bg-surface-muted" />
          {ROWS.map((row) => (
            <div key={row} className="flex items-center gap-3 py-2.5">
              <div className="size-7 animate-pulse rounded-full bg-surface-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-surface-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
