// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceChart } from "./price-chart";

const prices = [100, 120, 90, 110];

describe("PriceChart", () => {
  it("summarises the series for screen readers", () => {
    render(<PriceChart prices={prices} currency="USD" endTime={Date.now()} assetName="Bitcoin" />);
    expect(screen.getByRole("group")).toHaveAccessibleName(
      "Bitcoin over 7 days: from $100.00 to $110.00, up 10.00%. Low $90.00, high $120.00.",
    );
  });

  it("lets keyboard users step through points", async () => {
    const user = userEvent.setup();
    render(<PriceChart prices={prices} currency="USD" endTime={Date.now()} assetName="Bitcoin" />);

    await user.tab();
    await user.keyboard("{End}");
    expect(screen.getByText("$110.00")).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByText("$90.00", { selector: "span.font-medium" })).toBeInTheDocument();
    await user.keyboard("{Home}");
    expect(screen.getByText("$100.00")).toBeInTheDocument();
  });

  it("shows the 7-day change with a sign", () => {
    render(<PriceChart prices={[200, 100]} currency="USD" endTime={Date.now()} assetName="X" />);
    expect(screen.getByText("−50.00%")).toHaveClass("text-down");
  });
});
