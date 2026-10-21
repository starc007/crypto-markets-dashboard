// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { makeCoin, makeMarketsResponse } from "@/test/factories";
import { CompareView } from "./compare-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
}));

const markets = makeMarketsResponse([
  makeCoin({ id: "bitcoin", name: "Bitcoin", symbol: "BTC", rank: 1 }),
  makeCoin({ id: "ethereum", name: "Ethereum", symbol: "ETH", rank: 2 }),
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function renderCompare() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <CompareView initialIds={["bitcoin", "ethereum"]} initialMarkets={markets} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("CompareView", () => {
  it("shows an error with retry, not an endless placeholder, when history fails", async () => {
    let historyOk = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/history")) {
          if (!historyOk) return json({ error: { code: "INTERNAL", message: "Boom" } }, 500);
          const id = url.split("/")[3]!;
          return json({ id, fetchedAt: markets.meta.fetchedAt, prices: [100, 110, 105] });
        }
        return json(markets);
      }),
    );
    renderCompare();

    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByText(/couldn.t load price history/)).toBeInTheDocument();

    historyOk = true;
    await userEvent.click(retry);
    expect(
      await screen.findByRole("group", { name: /Performance over the period/ }),
    ).toBeInTheDocument();
  });
});
