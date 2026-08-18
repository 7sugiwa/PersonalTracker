import "server-only";

// Frankfurter — ECB reference rates, keyless, no documented rate limit.
// Verified live on 2026-08-17: GET /v1/latest?base=USD&symbols=IDR ->
// { amount, base, date, rates: { IDR: number } }
//
// Only USD/IDR is needed right now (VOO/SPY-style US assets are the only
// non-IDR-quoted asset class in this app), but this is written to accept
// any base/quote pair so a future non-USD asset doesn't need a new file.

export interface FxRate {
  rate: number;
  /** The date Frankfurter's ECB source actually priced this rate on —
   * not necessarily today (ECB doesn't publish on weekends/holidays).
   * The cron stores its OWN snapshot_on (today, WIB), not this value —
   * see app/api/cron/prices/route.ts. */
  sourceDate: string;
}

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function fetchFxRate(base: string, quote: string): Promise<FxRate | null> {
  const res = await fetch(
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;

  const json = (await res.json()) as FrankfurterResponse;
  const rate = json.rates[quote];
  if (typeof rate !== "number") return null;

  return { rate, sourceDate: json.date };
}
