import type { PriceResult } from "@/lib/prices/types";

// CoinGecko free public API — returns prices directly in IDR, so no FX
// conversion needed downstream. Coin ids (source_ref) are CoinGecko's
// internal id, not the ticker (e.g. "bitcoin", not "BTC"; "ripple" for
// XRP). Verified live on 2026-08-18.
//
// Batched, not one call per asset: the free tier's per-IP rate limit is
// tight enough that once this app tracked more than a handful of crypto
// assets, a sequential per-asset loop started 429ing partway through —
// silently truncating that day's crypto prices. CoinGecko's simple/price
// endpoint accepts a comma-separated id list in one call, so the cron
// fetches every active crypto asset's price in a single request instead.
//   GET /api/v3/simple/price?ids=bitcoin,ethereum,...&vs_currencies=idr
//   -> { [id]: { idr: number } }

type CoinGeckoResponse = Record<string, { idr?: number } | undefined>;

/** Never throws — a failed or partial batch degrades to "missing prices
 * for whichever ids didn't come back", same failure shape as any other
 * adapter returning null, not an aborted cron run. */
export async function fetchCoingeckoBatch(ids: string[]): Promise<Record<string, PriceResult>> {
  if (ids.length === 0) return {};

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=idr`,
      { cache: "no-store" },
    );
    if (!res.ok) return {};

    const json = (await res.json()) as CoinGeckoResponse;
    const out: Record<string, PriceResult> = {};
    for (const id of ids) {
      const price = json[id]?.idr;
      if (typeof price === "number") {
        out[id] = { price, currency: "IDR" };
      }
    }
    return out;
  } catch {
    return {};
  }
}
