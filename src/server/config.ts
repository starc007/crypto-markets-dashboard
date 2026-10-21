import "server-only";
import { z } from "zod";

/** CoinGecko Demo plan: 10,000 successful calls per month (100 per minute). */
export const DEMO_MONTHLY_QUOTA = 10_000;
const LONGEST_MONTH_MINUTES = 31 * 24 * 60;

const envSchema = z.object({
  COINGECKO_API_KEY: z
    .string()
    .trim()
    .transform((key) => key || undefined)
    .optional(),
  MARKETS_REFRESH_INTERVAL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
});

export interface ServerConfig {
  apiKey: string | undefined;
  refreshIntervalMs: number;
}

/** Worst case: one refresh per interval, all month, from a single instance. */
export function projectedMonthlyCalls(refreshIntervalMs: number): number {
  return Math.ceil((LONGEST_MONTH_MINUTES * 60_000) / refreshIntervalMs);
}

let cached: ServerConfig | undefined;

export function getServerConfig(): ServerConfig {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  const env = result.data;
  const config: ServerConfig = {
    apiKey: env.COINGECKO_API_KEY,
    refreshIntervalMs: env.MARKETS_REFRESH_INTERVAL_SECONDS * 1000,
  };

  if (!config.apiKey) {
    console.warn(
      "[config] COINGECKO_API_KEY is not set; using the keyless public API, which has lower rate limits.",
    );
  }
  const projected = projectedMonthlyCalls(config.refreshIntervalMs);
  if (projected > DEMO_MONTHLY_QUOTA) {
    console.warn(
      `[config] A ${env.MARKETS_REFRESH_INTERVAL_SECONDS}s refresh interval can use up to ${projected} calls/month, ` +
        `above the Demo quota of ${DEMO_MONTHLY_QUOTA}.`,
    );
  }

  cached = config;
  return config;
}
