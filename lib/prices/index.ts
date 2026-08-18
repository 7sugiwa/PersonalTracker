import type { PriceAdapter } from "@/lib/prices/types";
import { logamMuliaAdapter } from "@/lib/prices/logam-mulia";
import { yahooAdapter } from "@/lib/prices/yahoo";

export type { PriceAdapter, PriceResult, Asset } from "@/lib/prices/types";
export { fetchFxRate, type FxRate } from "@/lib/prices/fx";
export { fetchCoingeckoBatch } from "@/lib/prices/coingecko";

/** "manual" assets (e.g. a synthetic product with no public NAV) are
 * skipped by the cron entirely rather than adapted — there's nothing to
 * fetch, and returning null from a fake adapter would be indistinguishable
 * from a real fetch failure in the cron's logging. */
const manualAdapter: PriceAdapter = async () => null;

/** "coingecko" is deliberately absent here — it's batched separately in
 * lib/networth.ts (one request for every crypto asset) rather than
 * dispatched per-asset like these, see lib/prices/coingecko.ts for why. */
export const PRICE_ADAPTERS: Record<string, PriceAdapter> = {
  logam_mulia: logamMuliaAdapter,
  yahoo: yahooAdapter,
  manual: manualAdapter,
};

export function adapterFor(priceSource: string): PriceAdapter | null {
  return PRICE_ADAPTERS[priceSource] ?? null;
}
