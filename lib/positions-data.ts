import "server-only";
import { supabase } from "@/lib/supabase";
import { wibDateString } from "@/lib/wib";
import type { AssetClass } from "@/lib/db-types";

export interface Position {
  assetId: string;
  symbol: string;
  displayName: string;
  assetClass: AssetClass;
  unit: string;
  quantity: number;
  avgCostIdr: number;
  totalCostIdr: number;
  latestPrice: number | null;
  priceCurrency: string | null;
  priceOn: string | null;
  fxRate: number | null;
  /** null — never 0 — when the position couldn't be valued. A 0 here
   * would read as "worth nothing"; null reads as "not valued yet",
   * which is what an unpriced/FX-less asset actually is. */
  marketValueIdr: number | null;
  unrealizedIdr: number | null;
  /** null when totalCostIdr is 0 (seeded/gifted position — no
   * meaningful cost basis to divide by). */
  returnPct: number | null;
  /** Share of total PRICED market value — unpriced positions don't
   * participate, since they have no value to weigh against. */
  weight: number | null;
  priced: boolean;
  /** Same 5-day rule as findStaleAssets (lib/networth.ts). */
  stale: boolean;
}

export interface PositionsResult {
  positions: Position[];
  totals: { marketValue: number; costBasis: number; unrealized: number; returnPct: number | null };
  unpricedCount: number;
  asOf: string;
  /** True only when every position was priced — i.e. this table's sum
   * actually equals net_worth_snapshots.holdings_value for the same
   * day. See the get_positions() SQL comment for why an unpriced
   * position can't just be coalesced to 0 here. */
  reconcilesWithNetWorth: boolean;
}

const STALE_MAX_AGE_DAYS = 5;

export async function getPositions(asOf?: string): Promise<PositionsResult> {
  const db = supabase();
  const effectiveAsOf = asOf ?? wibDateString();

  const { data, error } = await db.rpc("get_positions", { as_of: effectiveAsOf });

  if (error) {
    // Most likely cause during rollout: the migration hasn't been
    // applied yet (supabase/migrations/0007_positions_function.sql),
    // so PostgREST 404s with "Could not find the function". Surface an
    // honest empty result rather than crashing the page — the UI's
    // empty state already tells the user what to check.
    console.error("get_positions rpc failed", error);
    return {
      positions: [],
      totals: { marketValue: 0, costBasis: 0, unrealized: 0, returnPct: null },
      unpricedCount: 0,
      asOf: effectiveAsOf,
      reconcilesWithNetWorth: true,
    };
  }

  const todayStr = wibDateString();
  const staleThreshold = new Date(`${todayStr}T00:00:00Z`);
  staleThreshold.setUTCDate(staleThreshold.getUTCDate() - STALE_MAX_AGE_DAYS);
  const staleThresholdStr = staleThreshold.toISOString().slice(0, 10);

  const rawPositions = (data ?? []).map((r) => {
    const marketValueIdr = r.market_value_idr !== null ? Number(r.market_value_idr) : null;
    const totalCostIdr = Number(r.total_cost_idr);
    const unrealizedIdr = marketValueIdr !== null ? marketValueIdr - totalCostIdr : null;
    return {
      assetId: r.asset_id,
      symbol: r.symbol,
      displayName: r.display_name,
      assetClass: r.asset_class as AssetClass,
      unit: r.unit,
      quantity: Number(r.quantity),
      avgCostIdr: Number(r.avg_cost_idr),
      totalCostIdr,
      latestPrice: r.latest_price !== null ? Number(r.latest_price) : null,
      priceCurrency: r.price_currency,
      priceOn: r.price_on,
      fxRate: r.fx_rate !== null ? Number(r.fx_rate) : null,
      marketValueIdr,
      unrealizedIdr,
      returnPct: marketValueIdr !== null && totalCostIdr !== 0 ? unrealizedIdr! / totalCostIdr : null,
      weight: null as number | null, // filled in below, needs the priced total first
      priced: r.priced,
      stale: r.price_on === null || r.price_on < staleThresholdStr,
    };
  });

  const totalMarketValue = rawPositions.reduce((s, p) => s + (p.marketValueIdr ?? 0), 0);
  const positions: Position[] = rawPositions.map((p) => ({
    ...p,
    weight: p.marketValueIdr !== null && totalMarketValue > 0 ? p.marketValueIdr / totalMarketValue : null,
  }));

  const totalCostBasis = positions.reduce((s, p) => s + p.totalCostIdr, 0);
  const totalUnrealized = totalMarketValue - totalCostBasis;
  const unpricedCount = positions.filter((p) => !p.priced).length;

  return {
    positions,
    totals: {
      marketValue: totalMarketValue,
      costBasis: totalCostBasis,
      unrealized: totalUnrealized,
      returnPct: totalCostBasis !== 0 ? totalUnrealized / totalCostBasis : null,
    },
    unpricedCount,
    asOf: effectiveAsOf,
    reconcilesWithNetWorth: unpricedCount === 0,
  };
}
