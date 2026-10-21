import {
  MIN_GRAPHIC_CONTRAST,
  THEME_SURFACES,
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
    expect(ensureContrast("#627EEA", THEME_SURFACES.dark)).toBe("#627EEA");
  });

  it("lightens near-black brand colours on dark surfaces", () => {
    const adjusted = ensureContrast("#23292F", THEME_SURFACES.dark);
    expect(adjusted).not.toBe("#23292F");
    expect(contrastRatio(adjusted, THEME_SURFACES.dark)).toBeGreaterThanOrEqual(
      MIN_GRAPHIC_CONTRAST,
    );
  });

  it("darkens pale brand colours on light surfaces", () => {
    const adjusted = ensureContrast("#97FCE4", THEME_SURFACES.light);
    expect(contrastRatio(adjusted, THEME_SURFACES.light)).toBeGreaterThanOrEqual(
      MIN_GRAPHIC_CONTRAST,
    );
  });
});

describe("deriveAccent", () => {
  it("keeps the brand colour and derives readable variants for both themes", () => {
    const accent = deriveAccent("#f7931a");
    expect(accent.brand).toBe("#F7931A");
    expect(contrastRatio(accent.light, THEME_SURFACES.light)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(accent.dark, THEME_SURFACES.dark)).toBeGreaterThanOrEqual(3);
  });
});

describe("parseHex", () => {
  it("rejects malformed colours", () => {
    expect(() => parseHex("#FFF")).toThrow();
    expect(() => parseHex("orange")).toThrow();
  });
});
