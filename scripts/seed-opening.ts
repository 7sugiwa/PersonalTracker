// Seeds REAL opening account balances and REAL pre-existing asset holdings.
//
// This is the one script in the repo that touches actual financial
// figures, so it never reads them from a committed file. Copy
// scripts/seed-opening.example.json to scripts/seed-opening.local.json
// (gitignored — see .gitignore and docs/plan.md § Public repository),
// fill in your real numbers, then run:
//
//   npx tsx scripts/seed-opening.ts
//
// Safe to re-run: account balances are upserted by name, and holdings are
// inserted as asset_buy transactions tagged parse_model='seed' — re-running
// after editing the JSON will insert duplicates for holdings, so if you
// need to correct a seeded holding, delete the old seed transactions first
// (`delete from transactions where parse_model = 'seed'`) rather than
// re-running blindly.
//
// Why holdings go through a transaction instead of writing `holdings`
// directly: `holdings` is a derived table, fully rebuilt by
// recompute_holdings() from transaction history (see
// supabase/migrations/0004_functions.sql) — writing it by hand would be
// silently overwritten the next time any asset_buy/asset_sell/undo/edit
// runs. The seed transaction's account is the bookkeeping-only "Opening
// Equity" account (see the account_kind comment in
// supabase/migrations/0001_schema.sql) precisely so this historical
// purchase doesn't double-debit a real account's cash — your real
// accounts' opening_balance already reflects the world post-purchase.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { supabase } from "@/lib/supabase-client";

const here = dirname(fileURLToPath(import.meta.url));
const LOCAL_PATH = join(here, "seed-opening.local.json");
const EXAMPLE_PATH = join(here, "seed-opening.example.json");

interface SeedFile {
  accounts: { name: string; opening_balance: number; opening_balance_on: string }[];
  holdings: {
    symbol: string;
    quantity: number;
    total_cost_idr: number;
    occurred_on: string;
    note?: string;
  }[];
}

function loadSeedFile(): SeedFile {
  if (!existsSync(LOCAL_PATH)) {
    console.error(
      `\nNo scripts/seed-opening.local.json found.\n\n` +
        `This file holds your real account balances and holdings, so it's\n` +
        `gitignored and never committed. To create it:\n\n` +
        `  cp ${EXAMPLE_PATH} ${LOCAL_PATH}\n\n` +
        `then edit it with your real figures and re-run this script.\n`,
    );
    process.exit(1);
  }
  const raw = readFileSync(LOCAL_PATH, "utf-8");
  return JSON.parse(raw) as SeedFile;
}

async function main() {
  const seed = loadSeedFile();
  const db = supabase();

  console.log("Updating opening account balances...");
  for (const acct of seed.accounts) {
    const { data, error } = await db
      .from("accounts")
      .update({
        opening_balance: acct.opening_balance,
        opening_balance_on: acct.opening_balance_on,
      })
      .eq("name", acct.name)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`account "${acct.name}": ${error.message}`);
    if (!data) {
      throw new Error(
        `account "${acct.name}" not found — run "npm run seed" first, or check the name matches scripts/seed.ts exactly.`,
      );
    }
    console.log(`  ${acct.name}: ${acct.opening_balance.toLocaleString("id-ID")} as of ${acct.opening_balance_on}`);
  }

  const { data: equityAccount, error: equityErr } = await db
    .from("accounts")
    .select("id")
    .eq("kind", "equity")
    .maybeSingle();
  if (equityErr) throw new Error(`opening equity account: ${equityErr.message}`);
  if (!equityAccount) {
    throw new Error(
      `No account with kind "equity" found — run "npm run seed" first (it creates "Opening Equity").`,
    );
  }

  console.log("\nSeeding pre-existing holdings...");
  for (const h of seed.holdings) {
    const { data: asset, error: assetErr } = await db
      .from("assets")
      .select("id")
      .eq("symbol", h.symbol)
      .maybeSingle();
    if (assetErr) throw new Error(`asset "${h.symbol}": ${assetErr.message}`);
    if (!asset) {
      throw new Error(
        `asset "${h.symbol}" not found — add it to scripts/seed.ts and run "npm run seed" first.`,
      );
    }

    const unitPrice = h.total_cost_idr / h.quantity;
    const { error: txErr } = await db.from("transactions").insert({
      type: "asset_buy",
      amount: h.total_cost_idr,
      currency: "IDR",
      account_id: equityAccount.id,
      asset_id: asset.id,
      quantity: h.quantity,
      unit_price: unitPrice,
      note: h.note ?? "opening balance seed",
      occurred_at: new Date(`${h.occurred_on}T00:00:00Z`).toISOString(),
      occurred_on: h.occurred_on,
      parse_model: "seed",
    });
    if (txErr) throw new Error(`holding "${h.symbol}": ${txErr.message}`);
    console.log(`  ${h.symbol}: ${h.quantity} units, cost basis ${h.total_cost_idr.toLocaleString("id-ID")} IDR`);
  }

  console.log("\nRecomputing holdings...");
  const { error: recomputeErr } = await db.rpc("recompute_holdings");
  if (recomputeErr) throw new Error(`recompute_holdings: ${recomputeErr.message}`);

  const { data: holdings } = await db
    .from("holdings")
    .select("asset_id, quantity, avg_cost_idr, total_cost_idr");
  console.log("\nFinal holdings:", holdings);
  console.log(
    `\nNote: seed-opening.local.json exists on disk with real figures — it's gitignored (verify with: git check-ignore -v scripts/seed-opening.local.json), so it won't be committed, but it's still readable by anything on this machine.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
