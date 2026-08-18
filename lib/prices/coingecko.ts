import type { PriceAdapter } from "@/lib/prices/types";

// CoinGecko free public API — returns prices directly in IDR, so no FX
// conversion needed downstream. `source_ref` is the CoinGecko coin id
// (e.g. "bitcoin", not the ticker "BTC"). Verified live on 2026-08-17:
//   GET /api/v3/simple/price?ids={id}&vs_currencies=idr
//   -> { [id]: { idr: number } }
// No API key required at low request volume (one call per active crypto
// asset, once a day).

type CoinGeckoResponse = Record<string, { idr?: number } | undefined>;

export const coingeckoAdapter: PriceAdapter = async (asset) => {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(asset.source_ref)}&vs_currencies=idr`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;

  const json = (await res.json()) as CoinGeckoResponse;
  const price = json[asset.source_ref]?.idr;
  if (typeof price !== "number") return null;

  return { price, currency: "IDR" };
};
