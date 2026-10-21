import type { CategoryId } from "./categories";

/**
 * Curated metadata keyed by CoinGecko coin id. Ids are stable; symbols are not
 * unique (many tokens share a ticker), so they are never used as keys.
 *
 * `colorSource` records provenance so reviewers know how much to trust a value:
 * - "brand": the colour published in the project's brand assets.
 * - "logo": sampled from the dominant colour of the official logo, used when no
 *   brand colour is published. Re-sample when a project rebrands.
 *
 * Run `pnpm check:metadata` to list current top-50 assets that are missing here.
 */
export interface AssetMetadata {
  category: CategoryId;
  color: `#${string}`;
  colorSource: "brand" | "logo";
}

export const ASSET_METADATA = {
  // A: base-layer networks
  bitcoin: { category: "A", color: "#F7931A", colorSource: "brand" },
  ethereum: { category: "A", color: "#627EEA", colorSource: "brand" },
  binancecoin: { category: "A", color: "#F0B90B", colorSource: "brand" },
  ripple: { category: "A", color: "#23292F", colorSource: "brand" },
  solana: { category: "A", color: "#9945FF", colorSource: "brand" },
  tron: { category: "A", color: "#FF060A", colorSource: "brand" },
  zcash: { category: "A", color: "#F4B728", colorSource: "brand" },
  hyperliquid: { category: "A", color: "#97FCE4", colorSource: "brand" },
  dogecoin: { category: "A", color: "#C2A633", colorSource: "brand" },
  monero: { category: "A", color: "#FF6600", colorSource: "brand" },
  cardano: { category: "A", color: "#0033AD", colorSource: "brand" },
  near: { category: "A", color: "#00EC97", colorSource: "brand" },
  stellar: { category: "A", color: "#141414", colorSource: "brand" },
  "bitcoin-cash": { category: "A", color: "#0AC18E", colorSource: "brand" },
  litecoin: { category: "A", color: "#345D9D", colorSource: "brand" },
  "avalanche-2": { category: "A", color: "#E84142", colorSource: "brand" },
  "canton-network": { category: "A", color: "#F2F28C", colorSource: "logo" },
  sui: { category: "A", color: "#4DA2FF", colorSource: "brand" },
  "the-open-network": { category: "A", color: "#0098EA", colorSource: "brand" },
  "hedera-hashgraph": { category: "A", color: "#222222", colorSource: "brand" },
  bittensor: { category: "A", color: "#2B2B2B", colorSource: "logo" },
  "crypto-com-chain": { category: "A", color: "#002D74", colorSource: "brand" },

  // B: stablecoins & tokenised assets
  tether: { category: "B", color: "#26A17B", colorSource: "brand" },
  "usd-coin": { category: "B", color: "#2775CA", colorSource: "brand" },
  usds: { category: "B", color: "#F89858", colorSource: "logo" },
  "ethena-usde": { category: "B", color: "#1F1F1F", colorSource: "logo" },
  dai: { category: "B", color: "#F5AC37", colorSource: "brand" },
  "usd1-wlfi": { category: "B", color: "#C9900B", colorSource: "logo" },
  "tether-gold": { category: "B", color: "#D9B65A", colorSource: "logo" },
  "global-dollar": { category: "B", color: "#384818", colorSource: "logo" },
  "paypal-usd": { category: "B", color: "#0070E0", colorSource: "brand" },
  "hashnote-usyc": { category: "B", color: "#082858", colorSource: "logo" },
  "ripple-usd": { category: "B", color: "#0868F8", colorSource: "logo" },
  "ondo-us-dollar-yield": { category: "B", color: "#082868", colorSource: "logo" },
  "blackrock-usd-institutional-digital-liquidity-fund": {
    category: "B",
    color: "#1A1A1A",
    colorSource: "brand",
  },
  "figure-heloc": { category: "B", color: "#5B5BF6", colorSource: "logo" },

  // C: apps & ecosystem tokens
  whitebit: { category: "C", color: "#20201F", colorSource: "logo" },
  chainlink: { category: "C", color: "#375BD2", colorSource: "brand" },
  "leo-token": { category: "C", color: "#0B0B1A", colorSource: "logo" },
  rain: { category: "C", color: "#E8F808", colorSource: "logo" },
  uniswap: { category: "C", color: "#FF007A", colorSource: "brand" },
  "shiba-inu": { category: "C", color: "#FFA409", colorSource: "brand" },
  bitway: { category: "C", color: "#98E878", colorSource: "logo" },
  "quant-network": { category: "C", color: "#1C1C1C", colorSource: "brand" },
  ethena: { category: "C", color: "#1A1A1A", colorSource: "logo" },
  okb: { category: "C", color: "#111111", colorSource: "brand" },
  aave: { category: "C", color: "#B6509E", colorSource: "brand" },
  "ondo-finance": { category: "C", color: "#0B2A6F", colorSource: "brand" },
  "worldcoin-wld": { category: "C", color: "#191919", colorSource: "logo" },
  "pump-fun": { category: "C", color: "#5ED88F", colorSource: "logo" },
} as const satisfies Record<string, AssetMetadata>;

export type KnownAssetId = keyof typeof ASSET_METADATA;

export function getAssetMetadata(id: string): AssetMetadata | undefined {
  return Object.hasOwn(ASSET_METADATA, id) ? ASSET_METADATA[id as KnownAssetId] : undefined;
}
