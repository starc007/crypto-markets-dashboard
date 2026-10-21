import {
  NOT_AVAILABLE,
  formatCompactCurrency,
  formatFullCurrency,
  formatPrice,
  formatCompactNumber,
  formatDuration,
  formatPercentChange,
  formatRelativeAge,
} from "./format";

describe("formatPrice", () => {
  it.each([
    [83321, "$83,321.00"],
    [2450.54, "$2,450.54"],
    [1.35, "$1.35"],
    [1, "$1.00"],
    [0.224786, "$0.2248"],
    [0.08176, "$0.08176"],
    [0.1, "$0.10"],
    [0.01, "$0.01"],
    [0.00925922, "$0.009259"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatPrice(value, "USD")).toBe(expected);
  });

  it("keeps four significant digits for very small prices", () => {
    expect(formatPrice(5.158035560662693e-6, "USD")).toBe("$0.000005158");
    expect(formatPrice(0.00000123456, "USD")).toBe("$0.000001235");
  });

  it("never uses scientific notation", () => {
    expect(formatPrice(5.16e-6, "USD")).not.toMatch(/e/i);
    expect(formatPrice(1e-12, "USD")).toBe("$0.000000000001");
  });

  it("never rounds a non-zero price down to zero", () => {
    for (const value of [1e-3, 1e-8, 1e-15, 1e-30]) {
      expect(formatPrice(value, "USD")).not.toBe("$0.00");
      expect(formatPrice(value, "USD")).toMatch(/[1-9]/);
    }
  });

  it("rounds stablecoins that are a hair under $1 consistently", () => {
    expect(formatPrice(0.99897, "USD")).toBe("$0.999");
    expect(formatPrice(0.99996, "USD")).toBe("$1.00");
  });

  it("shows a true zero as zero", () => {
    expect(formatPrice(0, "USD")).toBe("$0.00");
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    "renders %s as not available instead of 0",
    (value) => {
      expect(formatPrice(value, "USD")).toBe(NOT_AVAILABLE);
    },
  );
});

describe("other currencies", () => {
  it("uses the right symbol and the same precision rules", () => {
    expect(formatPrice(74_211.2127, "EUR")).toBe("€74,211.21");
    expect(formatPrice(0.0000045934, "GBP")).toBe("£0.000004593");
    expect(formatCompactCurrency(1_490_000_000_000, "EUR")).toBe("€1.49T");
    expect(formatFullCurrency(null, "GBP")).toBe(NOT_AVAILABLE);
  });
});

describe("formatCompactCurrency", () => {
  it.each([
    [1_674_647_371_324, "$1.67T"],
    [27_979_396_517, "$27.98B"],
    [725_270_000, "$725.27M"],
    [812.345, "$812.35"],
    [0, "$0.00"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatCompactCurrency(value, "USD")).toBe(expected);
  });

  it("moves to the next unit instead of showing 1000M", () => {
    expect(formatCompactCurrency(999_999_999, "USD")).toBe("$1.00B");
  });

  it("renders missing values as not available", () => {
    expect(formatCompactCurrency(null, "USD")).toBe(NOT_AVAILABLE);
  });
});

describe("formatFullCurrency", () => {
  it("shows whole dollars with grouping for tooltips", () => {
    expect(formatFullCurrency(1_674_647_371_324, "USD")).toBe("$1,674,647,371,324.00");
  });

  it("keeps small values precise", () => {
    expect(formatFullCurrency(0.00000516, "USD")).toBe("$0.00000516");
  });
});

describe("formatPercentChange", () => {
  it("signs positive and negative changes", () => {
    expect(formatPercentChange(2.23336)).toMatchObject({ text: "+2.23%", direction: "up" });
    expect(formatPercentChange(-0.56981)).toMatchObject({ text: "−0.57%", direction: "down" });
  });

  it("decides direction from the rounded value the user sees", () => {
    expect(formatPercentChange(-0.004)).toMatchObject({ text: "0.00%", direction: "flat" });
    expect(formatPercentChange(0.004)).toMatchObject({ text: "0.00%", direction: "flat" });
    expect(formatPercentChange(0.005)).toMatchObject({ text: "+0.01%", direction: "up" });
  });

  it("groups large changes", () => {
    expect(formatPercentChange(122775.83096).text).toBe("+122,775.83%");
  });

  it("gives screen readers words, not symbols", () => {
    expect(formatPercentChange(-1.5).label).toBe("down 1.50%");
    expect(formatPercentChange(0).label).toBe("unchanged, 0.00%");
  });

  it("marks missing values as not available", () => {
    expect(formatPercentChange(null)).toEqual({
      text: NOT_AVAILABLE,
      label: "not available",
      direction: null,
    });
  });
});

describe("formatCompactNumber", () => {
  it("formats supplies", () => {
    expect(formatCompactNumber(20_098_843)).toBe("20.1M");
    expect(formatCompactNumber(589_238_297_566_932)).toBe("589.24T");
  });
});

describe("durations", () => {
  it.each([
    [0, "just now"],
    [9_999, "just now"],
    [45_000, "45s ago"],
    [3 * 60_000, "3 min ago"],
    [2 * 3_600_000, "2 h ago"],
    [3 * 86_400_000, "3 d ago"],
  ])("formats an age of %sms as %s", (ms, expected) => {
    expect(formatRelativeAge(ms)).toBe(expected);
  });

  it("never shows negative durations", () => {
    expect(formatDuration(-5_000)).toBe("0s");
  });
});
