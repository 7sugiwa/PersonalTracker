import type { PriceAdapter } from "@/lib/prices/types";
import { logamMuliaAdapter } from "@/lib/prices/logam-mulia";
import { yahooAdapter } from "@/lib/prices/yahoo";
import { coingeckoAdapter } from "@/lib/prices/coingecko";

export type { PriceAdapter, PriceResult, Asset } from "@/lib/prices/types";
export { fetchFxRate, type FxRate } from "@/lib/prices/fx";

/** "manual" assets (e.g. a synthetic product with no public NAV) are
 * skipped by the cron entirely rather than adapted — there's nothing to
 * fetch, and returning null from a fake adapter would be indistinguishable
 * from a real fetch failure in the cron's logging. */
const manualAdapter: PriceAdapter = async () => null;

export const PRICE_ADAPTERS: Record<string, PriceAdapter> = {
  logam_mulia: logamMuliaAdapter,
  yahoo: yahooAdapter,
  coingecko: coingeckoAdapter,
  manual: manualAdapter,
};

export function adapterFor(priceSource: string): PriceAdapter | null {
  return PRICE_ADAPTERS[priceSource] ?? null;
}
