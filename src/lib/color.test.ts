import {
  MIN_GRAPHIC_CONTRAST,
  SURFACE,
  contrastRatio,
  deriveAccent,
  ensureContrast,
  parseHex,
} from "./color";

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
});

describe("ensureContrast", () => {
  it("leaves colours that already contrast untouched", () => {
    expect(ensureContrast("#627EEA", SURFACE)).toBe("#627EEA");
  });

  it("lightens near-black brand colours on dark surfaces", () => {
    const adjusted = ensureContrast("#23292F", "#0E1117");
    expect(adjusted).not.toBe("#23292F");
    expect(contrastRatio(adjusted, "#0E1117")).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
  });

  it("darkens pale brand colours on light surfaces", () => {
    const adjusted = ensureContrast("#97FCE4", SURFACE);
    expect(contrastRatio(adjusted, SURFACE)).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
  });
});

describe("deriveAccent", () => {
  it("keeps the brand colour and derives a readable display colour", () => {
    const accent = deriveAccent("#97fce4");
    expect(accent.brand).toBe("#97FCE4");
    expect(contrastRatio(accent.display, SURFACE)).toBeGreaterThanOrEqual(3);
  });
});

describe("parseHex", () => {
  it("rejects malformed colours", () => {
    expect(() => parseHex("#FFF")).toThrow();
    expect(() => parseHex("orange")).toThrow();
  });
});
