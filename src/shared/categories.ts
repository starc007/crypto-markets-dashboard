/**
 * Application-owned asset categories. These are product decisions, not market
 * data, so they live in code and change through review rather than at runtime.
 */
export const CATEGORY_IDS = ["A", "B", "C"] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  A: {
    id: "A",
    name: "Base-layer networks",
    description: "Native coins of independent blockchains.",
  },
  B: {
    id: "B",
    name: "Stablecoins & tokenised assets",
    description: "Tokens designed to track an off-chain reference such as USD or gold.",
  },
  C: {
    id: "C",
    name: "Apps & ecosystem tokens",
    description:
      "Exchange, DeFi, infrastructure and community tokens. Also the home for unclassified assets.",
  },
};

/** Where an asset lands when it has no curated metadata yet. */
export const FALLBACK_CATEGORY: CategoryId = "C";
