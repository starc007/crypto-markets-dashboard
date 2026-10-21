import fixture from "@/test/fixtures/coingecko-markets.json";
import { ASSET_METADATA, getAssetMetadata } from "./asset-metadata";
import { CATEGORY_IDS } from "./categories";

describe("asset metadata", () => {
  const entries = Object.entries(ASSET_METADATA);

  it.each(entries)("%s has a valid category and colour", (_id, metadata) => {
    expect(CATEGORY_IDS).toContain(metadata.category);
    expect(metadata.color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("covers every asset in the recorded top-50 snapshot", () => {
    const missing = fixture.map((coin) => coin.id).filter((id) => !getAssetMetadata(id));
    expect(missing).toEqual([]);
  });

  it("uses every category", () => {
    const used = new Set(entries.map(([, m]) => m.category));
    expect([...used].sort()).toEqual([...CATEGORY_IDS]);
  });

  it("does not resolve inherited object keys as asset ids", () => {
    expect(getAssetMetadata("constructor")).toBeUndefined();
    expect(getAssetMetadata("__proto__")).toBeUndefined();
  });
});
