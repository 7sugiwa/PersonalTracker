// Seeds categories, starter accounts, and starter assets.
//
// Safe to commit and safe to re-run: everything here is structural
// (what you track), never how much (opening balances/holdings live in
// scripts/seed-opening.ts, seeded from a gitignored *.local.json — see
// docs/plan.md § Public repository).
//
// Run with:
//   npx tsx scripts/seed.ts
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
// (e.g. `set -a; source .env.local; set +a; npx tsx scripts/seed.ts`).

import { supabase } from "@/lib/supabase-client";

const EXPENSE_CATEGORIES = [
  "food",
  "groceries",
  "transport",
  "bills",
  "rent",
  "health",
  "shopping",
  "entertainment",
  "education",
  "fees",
  "gifts",
  "uncategorized",
] as const;

const INCOME_CATEGORIES = [
  "salary",
  "freelance",
  "investment_income",
  "other_income",
] as const;

// Real accounts. Names are short and distinct; the model uses them
// verbatim when parsing "kopi 25rb gopay" style messages.
const ACCOUNTS = [
  { name: "Mandiri", kind: "bank" as const, is_default: true },
  { name: "BCA Syariah", kind: "bank" as const, is_default: false },
  { name: "OVO", kind: "ewallet" as const, is_default: false },
  { name: "ShopeePay", kind: "ewallet" as const, is_default: false },
  { name: "GoPay", kind: "ewallet" as const, is_default: false },
  { name: "Tokopedia", kind: "ewallet" as const, is_default: false },
  { name: "LinkAja", kind: "ewallet" as const, is_default: false },
  { name: "Pluang", kind: "broker" as const, is_default: false },
  { name: "Growin Mandiri", kind: "broker" as const, is_default: false },
  // Bookkeeping-only — see the account_kind comment in
  // supabase/migrations/0001_schema.sql. Used exclusively by
  // scripts/seed-opening.ts to seed pre-existing asset holdings without
  // double-counting their cost against a real account's cash. Never used
  // for anything else — it should never appear as a Telegram parse target.
  { name: "Opening Equity", kind: "equity" as const, is_default: false },
];

// Starter assets — one example per asset class, matching the four price
// adapters in lib/prices/. Add more rows here as you acquire more assets;
// each needs a price_source that has an adapter implementation.
const ASSETS = [
  {
    symbol: "GOLD_ANTAM",
    asset_class: "gold" as const,
    display_name: "Emas Antam",
    unit: "gram",
    quote_currency: "IDR",
    price_source: "logam_mulia",
    source_ref: "logammulia",
  },
  {
    symbol: "VOO",
    asset_class: "us_equity" as const,
    display_name: "Vanguard S&P 500 ETF",
    unit: "share",
    quote_currency: "USD",
    price_source: "yahoo",
    source_ref: "VOO",
  },
  {
    symbol: "BBCA",
    asset_class: "idx_equity" as const,
    display_name: "Bank Central Asia",
    unit: "share",
    quote_currency: "IDR",
    price_source: "yahoo",
    source_ref: "BBCA.JK",
  },
  {
    symbol: "BTC",
    asset_class: "crypto" as const,
    display_name: "Bitcoin",
    unit: "coin",
    quote_currency: "IDR",
    price_source: "coingecko",
    source_ref: "bitcoin",
  },
  {
    symbol: "BNB",
    asset_class: "crypto" as const,
    display_name: "BNB",
    unit: "coin",
    quote_currency: "IDR",
    price_source: "coingecko",
    source_ref: "binancecoin",
  },
  // No free live-price API for Indonesian retail sukuk or mutual fund
  // NAVs — price_source "manual" means the daily cron skips these
  // entirely (see lib/prices/index.ts); update price_snapshots by hand
  // when you check the value in-app.
  {
    symbol: "ST012T4",
    asset_class: "bond" as const,
    display_name: "Sukuk Tabungan ST012T4",
    unit: "unit",
    quote_currency: "IDR",
    price_source: "manual",
    source_ref: "manual",
  },
  {
    symbol: "SUCORINVEST_MMF",
    asset_class: "mutual_fund" as const,
    display_name: "Sucorinvest Sharia Money Market Fund",
    unit: "unit",
    quote_currency: "IDR",
    price_source: "manual",
    source_ref: "manual",
  },
];

async function main() {
  const db = supabase();

  console.log("Seeding categories...");
  const categoryRows = [
    ...EXPENSE_CATEGORIES.map((slug, i) => ({
      slug,
      label: slug.replace(/_/g, " "),
      kind: "expense" as const,
      sort: i,
    })),
    ...INCOME_CATEGORIES.map((slug, i) => ({
      slug,
      label: slug.replace(/_/g, " "),
      kind: "income" as const,
      sort: i,
    })),
  ];
  const { error: catErr } = await db
    .from("categories")
    .upsert(categoryRows, { onConflict: "slug" });
  if (catErr) throw new Error(`categories: ${catErr.message}`);
  console.log(`  ${categoryRows.length} categories OK`);

  console.log("Seeding accounts...");
  const { error: acctErr } = await db
    .from("accounts")
    .upsert(ACCOUNTS, { onConflict: "name" });
  if (acctErr) throw new Error(`accounts: ${acctErr.message}`);
  console.log(`  ${ACCOUNTS.length} accounts OK (edit names in scripts/seed.ts if these don't match reality)`);

  console.log("Seeding assets...");
  const { error: assetErr } = await db
    .from("assets")
    .upsert(ASSETS, { onConflict: "symbol" });
  if (assetErr) throw new Error(`assets: ${assetErr.message}`);
  console.log(`  ${ASSETS.length} assets OK`);

  console.log("\nDone. Next: apply migrations if you haven't, then run scripts/seed-opening.ts.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
