import "server-only";
import { supabase } from "@/lib/supabase";
import { wibDateString } from "@/lib/wib";

export async function getNetWorthSeries(days = 90) {
  const db = supabase();
  const { data } = await db
    .from("net_worth_snapshots")
    .select("snapshot_on, cash_balance, holdings_value, net_worth")
    .order("snapshot_on", { ascending: false })
    .limit(days);

  return (data ?? [])
    .map((r) => ({
      date: r.snapshot_on,
      cash: Number(r.cash_balance),
      holdings: Number(r.holdings_value),
      netWorth: Number(r.net_worth),
    }))
    .reverse();
}

export async function getLatestNetWorth() {
  const db = supabase();
  const { data } = await db
    .from("net_worth_snapshots")
    .select("snapshot_on, cash_balance, holdings_value, net_worth, breakdown")
    .order("snapshot_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    date: data.snapshot_on,
    cash: Number(data.cash_balance),
    holdings: Number(data.holdings_value),
    netWorth: Number(data.net_worth),
    breakdown: data.breakdown as Record<string, number>,
  };
}

/** Spend by category for the current WIB calendar month. */
export async function getSpendByCategory() {
  const db = supabase();
  const today = wibDateString();
  const monthStart = `${today.slice(0, 7)}-01`;

  const { data } = await db
    .from("transactions")
    .select("amount, category_id, categories(slug, label)")
    .eq("type", "expense")
    .is("deleted_at", null)
    .gte("occurred_on", monthStart)
    .lte("occurred_on", today);

  const byCategory = new Map<string, number>();
  for (const row of data ?? []) {
    const label = (row.categories as { label: string } | null)?.label ?? "uncategorized";
    byCategory.set(label, (byCategory.get(label) ?? 0) + Number(row.amount));
  }

  return Array.from(byCategory.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** Income vs expense, one point per WIB calendar month, last N months. */
export async function getIncomeVsExpenseSeries(months = 6) {
  const db = supabase();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = wibDateString(cutoff).slice(0, 7) + "-01";

  const { data } = await db
    .from("transactions")
    .select("type, amount, occurred_on")
    .in("type", ["income", "expense"])
    .is("deleted_at", null)
    .gte("occurred_on", cutoffStr);

  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const row of data ?? []) {
    const month = row.occurred_on.slice(0, 7);
    const bucket = byMonth.get(month) ?? { income: 0, expense: 0 };
    if (row.type === "income") bucket.income += Number(row.amount);
    else bucket.expense += Number(row.amount);
    byMonth.set(month, bucket);
  }

  return Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Per-account cash balance: opening_balance + net of income/expense/
 * asset_buy/asset_sell posted against that specific account. Separate
 * from compute_net_worth() (supabase/migrations/0005_networth_function.sql),
 * which only computes the TOTAL across all real accounts — this is the
 * per-account breakdown for the accounts table on the dashboard. */
export async function getAccountBalances() {
  const db = supabase();
  const { data: accounts } = await db
    .from("accounts")
    .select("id, name, kind, opening_balance")
    .neq("kind", "equity")
    .is("archived_at", null)
    .order("name");

  const { data: txs } = await db
    .from("transactions")
    .select("account_id, type, amount")
    .is("deleted_at", null)
    .in("type", ["income", "expense", "asset_buy", "asset_sell"]);

  const netByAccount = new Map<string, number>();
  for (const t of txs ?? []) {
    const sign = t.type === "income" || t.type === "asset_sell" ? 1 : -1;
    netByAccount.set(t.account_id, (netByAccount.get(t.account_id) ?? 0) + sign * Number(t.amount));
  }

  return (accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    balance: Number(a.opening_balance) + (netByAccount.get(a.id) ?? 0),
  }));
}

export interface RecentTransaction {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  occurredOn: string;
  accountName: string;
  categoryLabel: string | null;
  assetSymbol: string | null;
  quantity: number | null;
}

export async function getRecentTransactions(limit = 25): Promise<RecentTransaction[]> {
  const db = supabase();
  const { data } = await db
    .from("transactions")
    .select(
      // transactions has TWO foreign keys to accounts (account_id and
      // counter_account_id) — PostgREST can't infer which one "accounts(...)"
      // means, so the embed must name the FK constraint explicitly.
      "id, type, amount, note, occurred_on, quantity, accounts!transactions_account_id_fkey(name), categories(label), assets(symbol)",
    )
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    note: t.note,
    occurredOn: t.occurred_on,
    accountName: (t.accounts as { name: string } | null)?.name ?? "?",
    categoryLabel: (t.categories as { label: string } | null)?.label ?? null,
    assetSymbol: (t.assets as { symbol: string } | null)?.symbol ?? null,
    quantity: t.quantity ? Number(t.quantity) : null,
  }));
}
