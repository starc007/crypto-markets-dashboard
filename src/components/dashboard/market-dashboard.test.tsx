// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { WATCHLIST_STORAGE_KEY } from "@/hooks/use-watchlist";
import type { Currency } from "@/shared/currency";
import type { MarketsResponse } from "@/shared/market";
import { makeCoin, makeMarketsResponse } from "@/test/factories";
import { MarketDashboard } from "./market-dashboard";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

const NOW = Date.parse("2026-01-01T12:00:10.000Z");

const coins = [
  makeCoin({
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    rank: 1,
    priceUsd: 83_321,
    change24hPct: 2.2,
    marketCapUsd: 1.6e12,
    category: "A",
  }),
  makeCoin({
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    rank: 2,
    priceUsd: 2_450.5,
    change24hPct: -1.3,
    marketCapUsd: 3e11,
    category: "A",
  }),
  makeCoin({
    id: "tether",
    name: "Tether",
    symbol: "USDT",
    rank: 3,
    priceUsd: 0.99897,
    change24hPct: -0.004,
    marketCapUsd: 1.8e11,
    category: "B",
  }),
  makeCoin({
    id: "shiba-inu",
    name: "Shiba Inu",
    symbol: "SHIB",
    rank: 36,
    priceUsd: 5.16e-6,
    change24hPct: 3.9,
    marketCapUsd: 3e9,
    category: "C",
  }),
  makeCoin({
    id: "mystery",
    name: "Mystery",
    symbol: "MYS",
    rank: 50,
    priceUsd: null,
    change24hPct: null,
    marketCapUsd: null,
    volume24hUsd: null,
    category: "C",
  }),
];

function renderDashboard(
  initialData: MarketsResponse | null = makeMarketsResponse(coins),
  initialCurrency: Currency = "USD",
) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MarketDashboard initialData={initialData} initialCurrency={initialCurrency} />
    </QueryClientProvider>,
  );
}

function rowFor(name: string) {
  return screen.getByRole("link", { name }).closest("tr")!;
}

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function mockFetchOnce(body: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(body, status));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  window.localStorage.clear();
  document.cookie = "currency=; max-age=0; path=/";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MarketDashboard", () => {
  it("groups assets into the three categories", () => {
    renderDashboard();
    const sections = screen.getAllByRole("region");
    expect(sections.map((s) => within(s).getByRole("heading").textContent)).toEqual([
      "ACategory A: Base-layer networks",
      "BCategory B: Stablecoins & tokenised assets",
      "CCategory C: Apps & ecosystem tokens",
    ]);
    expect(within(sections[0]!).getAllByRole("row")).toHaveLength(3); // header + 2 assets
  });

  it("renders small prices, near-zero changes and missing values faithfully", () => {
    renderDashboard();
    expect(within(rowFor("Shiba Inu")).getByText("$0.00000516")).toBeInTheDocument();

    const tether = rowFor("Tether");
    expect(within(tether).getAllByText("0.00%")[0]).not.toHaveClass("text-down");
    expect(within(tether).getAllByText("unchanged, 0.00%")[0]).toBeInTheDocument();

    const mystery = rowFor("Mystery");
    expect(within(mystery).getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(within(mystery).queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });

  it("filters by search and offers a way back from an empty result", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDashboard();

    await user.type(screen.getByRole("searchbox", { name: "Search assets" }), "shib");
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.getByText("Showing 1 of 5 assets")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No assets match your filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("region")).toHaveLength(3);
  });

  it("sorts every group by the chosen column and exposes the state to assistive tech", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDashboard();
    const groupA = () => screen.getAllByRole("region")[0]!;
    const names = () =>
      within(groupA())
        .getAllByRole("link")
        .map((a) => a.textContent);

    await user.click(within(groupA()).getByRole("button", { name: "24h" }));
    expect(names()).toEqual(["Bitcoin", "Ethereum"]);
    expect(within(groupA()).getByRole("columnheader", { name: "24h" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );

    await user.click(within(groupA()).getByRole("button", { name: "24h" }));
    expect(names()).toEqual(["Ethereum", "Bitcoin"]);
    expect(within(groupA()).getByRole("columnheader", { name: "24h" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("persists the watchlist and can show only watched assets", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDashboard();

    const star = screen.getByRole("button", { name: "Watch Ethereum" });
    await user.click(star);
    expect(star).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY)!)).toEqual(["ethereum"]);

    await user.click(screen.getByRole("button", { name: /Watchlist/ }));
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Ethereum"]);
  });

  it("warns prominently when data is stale and says why", () => {
    renderDashboard(
      makeMarketsResponse(coins, {
        fetchedAt: "2026-01-01T11:30:00.000Z",
        generatedAt: "2026-01-01T12:00:00.000Z",
        lastRefreshFailure: {
          code: "RATE_LIMITED",
          at: "2026-01-01T11:59:00.000Z",
          retryAt: "2026-01-01T12:09:00.000Z",
        },
      }),
    );
    expect(screen.getByText(/Prices are out of date/)).toBeInTheDocument();
    expect(screen.getByText(/limiting requests/)).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });

  it("polls for new data and updates prices in place", async () => {
    renderDashboard();
    expect(within(rowFor("Bitcoin")).getByText("$83,321.00")).toBeInTheDocument();

    const updated = coins.map((c) => (c.id === "bitcoin" ? { ...c, priceUsd: 84_000 } : c));
    mockFetchOnce(
      makeMarketsResponse(updated, {
        fetchedAt: "2026-01-01T12:00:30.000Z",
        generatedAt: "2026-01-01T12:00:35.000Z",
      }),
    );
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(fetch).toHaveBeenCalledWith("/api/markets", expect.anything());
    expect(await within(rowFor("Bitcoin")).findByText("$84,000.00")).toBeInTheDocument();
  });

  it("keeps showing the last data when the server becomes unreachable, and says so", async () => {
    renderDashboard();
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await act(() => vi.advanceTimersByTimeAsync(5_000)); // the single retry

    expect(await screen.findByText(/can't reach the server/)).toBeInTheDocument();
    expect(within(rowFor("Bitcoin")).getByText("$83,321.00")).toBeInTheDocument();
  });

  it("shows an error, not empty or zeroed prices, when there is no data at all", async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      jsonResponse(
        { error: { code: "RATE_LIMITED", message: "Limited.", retryAfterSeconds: 120 } },
        503,
      ),
    );
    renderDashboard(null);
    await act(() => vi.advanceTimersByTimeAsync(5_000)); // initial attempt plus one retry

    expect(await screen.findByRole("alert")).toHaveTextContent(/temporarily unavailable/);
    expect(screen.getByRole("alert")).toHaveTextContent("retry in about 2 min");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("converts every value when the currency changes and remembers the choice", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDashboard();

    await user.click(screen.getByRole("radio", { name: /EUR/ }));

    // Factory rate: 0.9 EUR per USD, and the dollar rose 0.5% against the euro.
    const bitcoin = rowFor("Bitcoin");
    expect(within(bitcoin).getByText("€74,988.90")).toBeInTheDocument();
    // (1.022 × 1.005 − 1) = +2.711%: the 24h change is restated, not reused.
    expect(within(bitcoin).getAllByText("+2.71%")[0]).toBeInTheDocument();
    expect(screen.getByText(/1 USD = €0\.9000/)).toBeInTheDocument();
    expect(document.cookie).toContain("currency=EUR");
  });

  it("renders the saved currency on first paint", () => {
    renderDashboard(makeMarketsResponse(coins), "GBP");
    expect(screen.getByRole("radio", { name: /GBP/ })).toBeChecked();
    expect(within(rowFor("Bitcoin")).getByText("£66,656.80")).toBeInTheDocument();
  });

  it("falls back to USD, and says so, when rates are unavailable", () => {
    const response = { ...makeMarketsResponse(coins), fx: null };
    renderDashboard(response, "EUR");

    expect(within(rowFor("Bitcoin")).getByText("$83,321.00")).toBeInTheDocument();
    expect(screen.getByText(/Euro rates are unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /EUR/ })).toBeDisabled();
  });
});
