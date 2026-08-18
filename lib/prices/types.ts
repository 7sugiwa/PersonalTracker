import type { Database } from "@/lib/db-types";

export type Asset = Database["public"]["Tables"]["assets"]["Row"];

export interface PriceResult {
  price: number;
  currency: string;
}

/**
 * Every adapter returns null instead of throwing on failure — a broken
 * scraper for one asset must never abort the whole cron run (see
 * app/api/cron/prices/route.ts, which isolates each asset's fetch in its
 * own try/catch anyway, but adapters returning null keeps that logic
 * simple instead of every call site needing a try/catch around every
 * adapter invocation).
 */
export type PriceAdapter = (asset: Asset) => Promise<PriceResult | null>;
