import type { PriceAdapter } from "@/lib/prices/types";

// Unofficial Yahoo Finance chart endpoint. Covers BOTH US equities
// (source_ref = "VOO") and IDX equities (source_ref = "BBCA.JK") from one
// adapter, which is the whole reason it's primary over Alpha Vantage for
// US symbols too — Alpha Vantage's free tier is capped at 25 requests/day
// and doesn't cover IDX at all.
//
// Verified live on 2026-08-17. Two things this endpoint requires that are
// easy to miss and fail silently without:
//   1. A browser-like User-Agent — without one it returns 429 on every
//      request, not just under load (confirmed by testing bare curl).
//   2. meta.currency on the response tells you what currency the price is
//      actually in (USD for VOO, IDR for BBCA.JK) — don't assume from the
//      asset's own quote_currency field, read it from the response, so a
//      currency mismatch surfaces as a fetch-time inconsistency rather
//      than a silently wrong net worth figure.
//
// This is unofficial and can break without notice — see the staleness
// banner in app/(dashboard)/, which is the actual defense here, not this
// adapter being bulletproof.

interface YahooChartResponse {
  chart: {
    result: [{ meta: { regularMarketPrice: number; currency: string } }] | null;
    error: unknown;
  };
}

export const yahooAdapter: PriceAdapter = async (asset) => {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.source_ref)}`,
    {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
    },
  );
  if (!res.ok) return null;

  const json = (await res.json()) as YahooChartResponse;
  const meta = json.chart.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;

  return { price: meta.regularMarketPrice, currency: meta.currency };
};
