import "server-only";
import { supabase } from "@/lib/supabase";
import { adapterFor, fetchFxRate } from "@/lib/prices";
import { wibDateString } from "@/lib/wib";

export interface RunResult {
  snapshotOn: string;
  assetsUpdated: string[];
  assetsFailed: { symbol: string; reason: string }[];
  fxUpdated: boolean;
  netWorth: { cashBalance: number; holdingsValue: number; netWorth: number } | null;
}

/**
 * The full daily job: fetch every active asset's price, fetch USD/IDR FX,
 * write today's price_snapshots + fx_rates (idempotent upserts — running
 * this twice in one day must not duplicate or corrupt anything, since
 * Vercel's cron can fire anywhere within its scheduled hour and a manual
 * re-run is the documented recovery path for a failed day), then compute
 * and store today's net_worth_snapshots row.
 *
 * One asset's fetch failing must never abort the run for the others —
 * each is isolated in its own try/catch.
 */
export async function runDailyPriceUpdate(): Promise<RunResult> {
  const db = supabase();
  const snapshotOn = wibDateString();

  const { data: assets, error: assetsErr } = await db
    .from("assets")
    .select("id, symbol, asset_class, price_source, source_ref, quote_currency")
    .eq("is_active", true);
  if (assetsErr) throw new Error(`loading assets: ${assetsErr.message}`);

  const assetsUpdated: string[] = [];
  const assetsFailed: { symbol: string; reason: string }[] = [];

  for (const asset of assets ?? []) {
    try {
      const adapter = adapterFor(asset.price_source);
      if (!adapter) {
        assetsFailed.push({ symbol: asset.symbol, reason: `no adapter for price_source "${asset.price_source}"` });
        continue;
      }

      const result = await adapter({
        id: asset.id,
        symbol: asset.symbol,
        asset_class: asset.asset_class,
        display_name: "",
        unit: "",
        quote_currency: asset.quote_currency,
        price_source: asset.price_source,
        source_ref: asset.source_ref,
        is_active: true,
        created_at: "",
      });

      if (!result) {
        assetsFailed.push({ symbol: asset.symbol, reason: "adapter returned no price" });
        continue;
      }

      const { error: upsertErr } = await db.from("price_snapshots").upsert(
        {
          asset_id: asset.id,
          price: result.price,
          currency: result.currency,
          source: asset.price_source,
          snapshot_on: snapshotOn,
        },
        { onConflict: "asset_id,snapshot_on" },
      );
      if (upsertErr) {
        assetsFailed.push({ symbol: asset.symbol, reason: `upsert failed: ${upsertErr.message}` });
        continue;
      }

      assetsUpdated.push(asset.symbol);
    } catch (err) {
      assetsFailed.push({
        symbol: asset.symbol,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let fxUpdated = false;
  try {
    const fx = await fetchFxRate("USD", "IDR");
    if (fx) {
      const { error: fxErr } = await db.from("fx_rates").upsert(
        { base: "USD", quote: "IDR", rate: fx.rate, snapshot_on: snapshotOn },
        { onConflict: "base,quote,snapshot_on" },
      );
      fxUpdated = !fxErr;
      if (fxErr) console.error("fx_rates upsert failed", fxErr);
    }
  } catch (err) {
    console.error("FX fetch failed", err);
  }

  let netWorth: RunResult["netWorth"] = null;
  const { data: nw, error: nwErr } = await db.rpc("compute_net_worth", {
    as_of: snapshotOn,
  });
  if (nwErr) {
    console.error("compute_net_worth failed", nwErr);
  } else if (nw && nw[0]) {
    const row = nw[0];
    const { error: snapErr } = await db.from("net_worth_snapshots").upsert(
      {
        snapshot_on: snapshotOn,
        cash_balance: row.cash_balance,
        holdings_value: row.holdings_value,
        net_worth: row.net_worth,
        breakdown: row.breakdown,
      },
      { onConflict: "snapshot_on" },
    );
    if (snapErr) {
      console.error("net_worth_snapshots upsert failed", snapErr);
    } else {
      netWorth = {
        cashBalance: Number(row.cash_balance),
        holdingsValue: Number(row.holdings_value),
        netWorth: Number(row.net_worth),
      };
    }
  }

  return { snapshotOn, assetsUpdated, assetsFailed, fxUpdated, netWorth };
}

/** Assets whose newest price snapshot is more than `maxAgeDays` old — the
 * data behind the dashboard's staleness banner (see docs/plan.md: "a
 * silently-dead scraper that leaves net worth frozen is worse than a
 * visible error"). */
export async function findStaleAssets(maxAgeDays = 5) {
  const db = supabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffStr = wibDateString(cutoff);

  const { data: assets } = await db
    .from("assets")
    .select("id, symbol, display_name")
    .eq("is_active", true);

  const stale: { symbol: string; displayName: string; latestSnapshotOn: string | null }[] = [];

  for (const asset of assets ?? []) {
    const { data: latest } = await db
      .from("price_snapshots")
      .select("snapshot_on")
      .eq("asset_id", asset.id)
      .order("snapshot_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest || latest.snapshot_on < cutoffStr) {
      stale.push({
        symbol: asset.symbol,
        displayName: asset.display_name,
        latestSnapshotOn: latest?.snapshot_on ?? null,
      });
    }
  }

  return stale;
}
