/**
 * Lists current top-50 assets that have no curated category or colour, and
 * curated entries that have dropped out of the top 50. Run it on a schedule
 * (or before a release) and add or prune entries in src/shared/asset-metadata.ts.
 *
 *   pnpm check:metadata
 *
 * Exits non-zero when assets are missing, so it can gate CI. Uses one API call.
 */
import { ASSET_METADATA } from "../src/shared/asset-metadata";

const url =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1";

async function main() {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.COINGECKO_API_KEY?.trim();
  if (key) headers["x-cg-demo-api-key"] = key;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`CoinGecko responded with HTTP ${response.status}`);
  const coins = (await response.json()) as { id: string; name: string; image: string }[];

  const curated = new Set(Object.keys(ASSET_METADATA));
  const current = new Set(coins.map((c) => c.id));
  const missing = coins.filter((c) => !curated.has(c.id));
  const departed = [...curated].filter((id) => !current.has(id));

  if (departed.length > 0) {
    console.log(`No longer in the top 50 (safe to keep or remove):\n  ${departed.join("\n  ")}\n`);
  }
  if (missing.length === 0) {
    console.log("All current top-50 assets have curated metadata.");
    return;
  }
  console.log("Missing metadata (shown in category C with a neutral colour until added):");
  for (const coin of missing) console.log(`  ${coin.id}  (${coin.name})  logo: ${coin.image}`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 2;
});
