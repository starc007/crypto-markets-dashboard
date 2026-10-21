interface Searchable {
  name: string;
  symbol: string;
  rank: number | null;
}

/**
 * Ranks assets for a quick-jump search. An exact ticker beats everything
 * ("eth" → Ethereum before Tether), then prefixes, then any word in the name,
 * then substrings. Ties go to the larger asset.
 */
export function searchAssets<T extends Searchable>(
  assets: readonly T[],
  query: string,
  limit = 8,
): T[] {
  const q = query.trim().toLowerCase();
  const byRank = (a: T, b: T) => (a.rank ?? Infinity) - (b.rank ?? Infinity);
  if (q === "") return [...assets].sort(byRank).slice(0, limit);

  const score = (asset: T): number | null => {
    const symbol = asset.symbol.toLowerCase();
    const name = asset.name.toLowerCase();
    if (symbol === q) return 0;
    if (symbol.startsWith(q)) return 1;
    if (name.startsWith(q)) return 2;
    if (name.split(/[\s-]+/).some((word) => word.startsWith(q))) return 3;
    if (name.includes(q) || symbol.includes(q)) return 4;
    return null;
  };

  return assets
    .map((asset) => ({ asset, score: score(asset) }))
    .filter((entry): entry is { asset: T; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || byRank(a.asset, b.asset))
    .slice(0, limit)
    .map((entry) => entry.asset);
}
