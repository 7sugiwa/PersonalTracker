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
    symbol: "SPY",
    asset_class: "us_equity" as const,
    display_name: "SPDR S&P 500 ETF Trust",
    unit: "share",
    quote_currency: "USD",
    price_source: "yahoo",
    source_ref: "SPY",
  },
  // Popular US ETFs/stocks — verified live against the Yahoo chart
  // endpoint on 2026-08-18. Same adapter as VOO/SPY above; add more the
  // same way (source_ref = the plain Yahoo ticker) as you need them.
  { symbol: "QQQ", asset_class: "us_equity" as const, display_name: "Invesco QQQ Trust (Nasdaq-100)", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "QQQ" },
  { symbol: "VTI", asset_class: "us_equity" as const, display_name: "Vanguard Total Stock Market ETF", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "VTI" },
  { symbol: "IVV", asset_class: "us_equity" as const, display_name: "iShares Core S&P 500 ETF", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "IVV" },
  { symbol: "DIA", asset_class: "us_equity" as const, display_name: "SPDR Dow Jones Industrial Average ETF", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "DIA" },
  { symbol: "AAPL", asset_class: "us_equity" as const, display_name: "Apple", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "AAPL" },
  { symbol: "MSFT", asset_class: "us_equity" as const, display_name: "Microsoft", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "MSFT" },
  { symbol: "GOOGL", asset_class: "us_equity" as const, display_name: "Alphabet (Google) Class A", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "GOOGL" },
  { symbol: "AMZN", asset_class: "us_equity" as const, display_name: "Amazon", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "AMZN" },
  { symbol: "NVDA", asset_class: "us_equity" as const, display_name: "Nvidia", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "NVDA" },
  { symbol: "META", asset_class: "us_equity" as const, display_name: "Meta Platforms", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "META" },
  { symbol: "TSLA", asset_class: "us_equity" as const, display_name: "Tesla", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "TSLA" },
  { symbol: "BRK.B", asset_class: "us_equity" as const, display_name: "Berkshire Hathaway Class B", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "BRK-B" },
  { symbol: "JPM", asset_class: "us_equity" as const, display_name: "JPMorgan Chase", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "JPM" },
  { symbol: "V", asset_class: "us_equity" as const, display_name: "Visa", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "V" },
  { symbol: "JNJ", asset_class: "us_equity" as const, display_name: "Johnson & Johnson", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "JNJ" },
  { symbol: "WMT", asset_class: "us_equity" as const, display_name: "Walmart", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "WMT" },
  { symbol: "PG", asset_class: "us_equity" as const, display_name: "Procter & Gamble", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "PG" },
  { symbol: "HD", asset_class: "us_equity" as const, display_name: "Home Depot", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "HD" },
  { symbol: "MA", asset_class: "us_equity" as const, display_name: "Mastercard", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "MA" },
  { symbol: "DIS", asset_class: "us_equity" as const, display_name: "Walt Disney", unit: "share", quote_currency: "USD", price_source: "yahoo", source_ref: "DIS" },
  {
    symbol: "BBCA",
    asset_class: "idx_equity" as const,
    display_name: "Bank Central Asia",
    unit: "share",
    quote_currency: "IDR",
    price_source: "yahoo",
    source_ref: "BBCA.JK",
  },
  // Popular IDX (LQ45) stocks — verified live against Yahoo (ticker + JK
  // suffix) on 2026-08-18. Add more the same way.
  { symbol: "BBRI", asset_class: "idx_equity" as const, display_name: "Bank Rakyat Indonesia", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "BBRI.JK" },
  { symbol: "BMRI", asset_class: "idx_equity" as const, display_name: "Bank Mandiri", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "BMRI.JK" },
  { symbol: "BBNI", asset_class: "idx_equity" as const, display_name: "Bank Negara Indonesia", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "BBNI.JK" },
  { symbol: "TLKM", asset_class: "idx_equity" as const, display_name: "Telkom Indonesia", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "TLKM.JK" },
  { symbol: "ASII", asset_class: "idx_equity" as const, display_name: "Astra International", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "ASII.JK" },
  { symbol: "UNVR", asset_class: "idx_equity" as const, display_name: "Unilever Indonesia", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "UNVR.JK" },
  { symbol: "ICBP", asset_class: "idx_equity" as const, display_name: "Indofood CBP Sukses Makmur", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "ICBP.JK" },
  { symbol: "INDF", asset_class: "idx_equity" as const, display_name: "Indofood Sukses Makmur", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "INDF.JK" },
  { symbol: "ADRO", asset_class: "idx_equity" as const, display_name: "Adaro Energy", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "ADRO.JK" },
  { symbol: "PGAS", asset_class: "idx_equity" as const, display_name: "Perusahaan Gas Negara", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "PGAS.JK" },
  { symbol: "PTBA", asset_class: "idx_equity" as const, display_name: "Bukit Asam", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "PTBA.JK" },
  { symbol: "ANTM", asset_class: "idx_equity" as const, display_name: "Aneka Tambang", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "ANTM.JK" },
  { symbol: "MDKA", asset_class: "idx_equity" as const, display_name: "Merdeka Copper Gold", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "MDKA.JK" },
  { symbol: "GOTO", asset_class: "idx_equity" as const, display_name: "GoTo Gojek Tokopedia", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "GOTO.JK" },
  { symbol: "BUKA", asset_class: "idx_equity" as const, display_name: "Bukalapak.com", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "BUKA.JK" },
  { symbol: "EMTK", asset_class: "idx_equity" as const, display_name: "Elang Mahkota Teknologi", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "EMTK.JK" },
  { symbol: "KLBF", asset_class: "idx_equity" as const, display_name: "Kalbe Farma", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "KLBF.JK" },
  { symbol: "SMGR", asset_class: "idx_equity" as const, display_name: "Semen Indonesia", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "SMGR.JK" },
  { symbol: "INCO", asset_class: "idx_equity" as const, display_name: "Vale Indonesia", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "INCO.JK" },
  { symbol: "CPIN", asset_class: "idx_equity" as const, display_name: "Charoen Pokphand Indonesia", unit: "share", quote_currency: "IDR", price_source: "yahoo", source_ref: "CPIN.JK" },
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
  // Popular crypto by market cap — verified live against CoinGecko's
  // simple/price endpoint on 2026-08-18. source_ref is CoinGecko's
  // internal coin id, not the ticker (they usually differ). Polygon uses
  // "polygon-ecosystem-token" (POL), the current token post-MATIC rebrand
  // — "matic-network" still resolves but is the legacy token.
  { symbol: "ETH", asset_class: "crypto" as const, display_name: "Ethereum", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "ethereum" },
  { symbol: "SOL", asset_class: "crypto" as const, display_name: "Solana", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "solana" },
  { symbol: "XRP", asset_class: "crypto" as const, display_name: "XRP", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "ripple" },
  { symbol: "ADA", asset_class: "crypto" as const, display_name: "Cardano", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "cardano" },
  { symbol: "DOGE", asset_class: "crypto" as const, display_name: "Dogecoin", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "dogecoin" },
  { symbol: "TRX", asset_class: "crypto" as const, display_name: "Tron", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "tron" },
  { symbol: "TON", asset_class: "crypto" as const, display_name: "Toncoin", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "the-open-network" },
  { symbol: "DOT", asset_class: "crypto" as const, display_name: "Polkadot", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "polkadot" },
  { symbol: "LINK", asset_class: "crypto" as const, display_name: "Chainlink", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "chainlink" },
  { symbol: "SHIB", asset_class: "crypto" as const, display_name: "Shiba Inu", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "shiba-inu" },
  { symbol: "AVAX", asset_class: "crypto" as const, display_name: "Avalanche", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "avalanche-2" },
  { symbol: "LTC", asset_class: "crypto" as const, display_name: "Litecoin", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "litecoin" },
  { symbol: "BCH", asset_class: "crypto" as const, display_name: "Bitcoin Cash", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "bitcoin-cash" },
  { symbol: "UNI", asset_class: "crypto" as const, display_name: "Uniswap", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "uniswap" },
  { symbol: "ATOM", asset_class: "crypto" as const, display_name: "Cosmos", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "cosmos" },
  { symbol: "XLM", asset_class: "crypto" as const, display_name: "Stellar", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "stellar" },
  { symbol: "NEAR", asset_class: "crypto" as const, display_name: "NEAR Protocol", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "near" },
  { symbol: "POL", asset_class: "crypto" as const, display_name: "Polygon", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "polygon-ecosystem-token" },
  { symbol: "SUI", asset_class: "crypto" as const, display_name: "Sui", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "sui" },
  { symbol: "APT", asset_class: "crypto" as const, display_name: "Aptos", unit: "coin", quote_currency: "IDR", price_source: "coingecko", source_ref: "aptos" },
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
