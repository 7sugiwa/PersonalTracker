import "server-only";
import { supabase } from "@/lib/supabase";
import { wibDateString } from "@/lib/wib";
import { SERIES_SLOT, type SeriesKey } from "@/lib/series";
import type { AssetClass } from "@/lib/db-types";

export async function getNetWorthSeries(days = 90) {
  const db = supabase();
  // Was `.limit(days)` on a desc order, i.e. "last N *snapshots*", not
  // "last N *days*" — with one failed cron day those diverge and the
  // chart silently understates its own range. Bound by date instead;
  // the .limit(400) is just a sanity cap (400 days > any range this UI
  // offers), not the selection mechanism.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const { data } = await db
    .from("net_worth_snapshots")
    .select("snapshot_on, cash_balance, holdings_value, net_worth")
    .gte("snapshot_on", wibDateString(cutoff))
    .order("snapshot_on", { ascending: true })
    .limit(400);

  return (data ?? []).map((r) => ({
    date: r.snapshot_on,
    cash: Number(r.cash_balance),
    holdings: Number(r.holdings_value),
    netWorth: Number(r.net_worth),
  }));
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

  // categoryId is required by the drilldown link (BarList row ->
  // /transactions?category={id}) — the old version only grouped by
  // label text, which isn't a valid filter value.
  const byCategory = new Map<string, { categoryId: string | null; label: string; total: number }>();
  for (const row of data ?? []) {
    const cat = row.categories as { label: string } | null;
    const label = cat?.label ?? "uncategorized";
    const key = row.category_id ?? "uncategorized";
    const existing = byCategory.get(key);
    if (existing) {
      existing.total += Number(row.amount);
    } else {
      byCategory.set(key, { categoryId: row.category_id, label, total: Number(row.amount) });
    }
  }

  return Array.from(byCategory.values()).sort((a, b) => b.total - a.total);
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

  // Zero-fill every month in the range, not just months that have
  // transactions — otherwise a quiet month collapses out of the axis
  // and its neighbours become visually adjacent, implying they're
  // consecutive when they aren't.
  const todayMonth = wibDateString().slice(0, 7);
  const cursor = new Date(cutoff.getFullYear(), cutoff.getMonth(), 1);
  const out: { month: string; income: number; expense: number }[] = [];
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    out.push({ month: key, ...(byMonth.get(key) ?? { income: 0, expense: 0 }) });
    if (key >= todayMonth) break;
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return out;
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
  counterAccountName: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  assetId: string | null;
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
      // means, so each embed must name the FK constraint explicitly.
      "id, type, amount, note, occurred_on, quantity, category_id, asset_id, accounts!transactions_account_id_fkey(name), counter_account:accounts!transactions_counter_account_id_fkey(name), categories(label), assets(symbol)",
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
    // Only transfers move money between two accounts — this is null
    // for every other transaction type, since counter_account_id is
    // only ever set on those rows.
    counterAccountName: (t.counter_account as { name: string } | null)?.name ?? null,
    categoryId: t.category_id,
    categoryLabel: (t.categories as { label: string } | null)?.label ?? null,
    assetId: t.asset_id,
    assetSymbol: (t.assets as { symbol: string } | null)?.symbol ?? null,
    quantity: t.quantity ? Number(t.quantity) : null,
  }));
}

// ------------------------------------------------------------------ //
// KPI deltas, sparkline, and MTD spend comparison.
// ------------------------------------------------------------------ //

interface SnapshotRow {
  date: string;
  cash: number;
  holdings: number;
  netWorth: number;
}

/** Shared by getNetWorthKpis and (Phase 7) getAllocationSeries — one
 * round trip feeding multiple derived views, so the KPI total is
 * guaranteed to equal whatever a chart built from the same rows shows
 * as its latest point. */
async function loadSnapshots(sinceDays = 400): Promise<SnapshotRow[]> {
  const db = supabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - sinceDays);
  const { data } = await db
    .from("net_worth_snapshots")
    .select("snapshot_on, cash_balance, holdings_value, net_worth")
    .gte("snapshot_on", wibDateString(cutoff))
    .order("snapshot_on", { ascending: true })
    .limit(sinceDays + 10);

  return (data ?? []).map((r) => ({
    date: r.snapshot_on,
    cash: Number(r.cash_balance),
    holdings: Number(r.holdings_value),
    netWorth: Number(r.net_worth),
  }));
}

/** Pure calendar-date arithmetic on a YYYY-MM-DD string — not a
 * timezone conversion, so anchoring the parse at UTC midnight is safe
 * and keeps this independent of the server's local TZ. */
function shiftDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type DeltaWindow = "1d" | "7d" | "30d" | "ytd";

export interface NetWorthDelta {
  window: DeltaWindow;
  fromDate: string;
  fromValue: number;
  abs: number;
  pct: number | null;
}

export interface NetWorthKpis {
  latest: { date: string; netWorth: number; cash: number; holdings: number } | null;
  firstSnapshotOn: string | null;
  snapshotCount: number;
  /** A window key is ABSENT — not present with a zero/estimated value —
   * when there's no snapshot old enough to compare against. Never
   * fall back to the earliest snapshot and mislabel it; that's a lie
   * by rounding. */
  deltas: Partial<Record<DeltaWindow, NetWorthDelta>>;
  /** Last <=30 net worth values. Empty below 3 points: 2 points is a
   * straight segment reading as "no volatility", 1 is flat reading as
   * "no change". */
  sparkline: number[];
}

export async function getNetWorthKpis(): Promise<NetWorthKpis> {
  const snaps = await loadSnapshots(400);
  if (snaps.length === 0) {
    return { latest: null, firstSnapshotOn: null, snapshotCount: 0, deltas: {}, sparkline: [] };
  }

  const latest = snaps[snaps.length - 1];

  // Largest snapshot_on <= targetDate. snaps is ascending, so the last
  // row satisfying the predicate is the floor.
  function floorAt(targetDate: string): SnapshotRow | null {
    let found: SnapshotRow | null = null;
    for (const s of snaps) {
      if (s.date <= targetDate) found = s;
      else break;
    }
    return found;
  }

  const windows: Array<{ key: DeltaWindow; target: string }> = [
    { key: "1d", target: shiftDateString(latest.date, -1) },
    { key: "7d", target: shiftDateString(latest.date, -7) },
    { key: "30d", target: shiftDateString(latest.date, -30) },
    { key: "ytd", target: `${latest.date.slice(0, 4)}-01-01` },
  ];

  const deltas: Partial<Record<DeltaWindow, NetWorthDelta>> = {};
  for (const w of windows) {
    const from = floorAt(w.target);
    if (!from || from.date === latest.date) continue;
    const abs = latest.netWorth - from.netWorth;
    const pct = from.netWorth !== 0 ? abs / Math.abs(from.netWorth) : null;
    deltas[w.key] = { window: w.key, fromDate: from.date, fromValue: from.netWorth, abs, pct };
  }

  const tail = snaps.slice(-30).map((s) => s.netWorth);

  return {
    latest: { date: latest.date, netWorth: latest.netWorth, cash: latest.cash, holdings: latest.holdings },
    firstSnapshotOn: snaps[0].date,
    snapshotCount: snaps.length,
    deltas,
    sparkline: tail.length >= 3 ? tail : [],
  };
}

export interface SpendComparison {
  mtd: number;
  mtdRange: { from: string; to: string };
  prev: number;
  prevRange: { from: string; to: string };
  abs: number;
  pct: number | null;
  /** Cumulative MTD spend, one point per elapsed day this month — for
   * the MTD sparkline. */
  daily: number[];
}

/** Month-to-date expense vs the SAME day-of-month range last month
 * (e.g. "vs Jul 1–19", not all of July) — comparing a partial month to
 * a full one is the classic dashboard lie. */
export async function getMonthToDateSpend(): Promise<SpendComparison> {
  const db = supabase();
  const today = wibDateString();
  const [y, m, d] = today.split("-").map(Number);
  const mtdFrom = `${today.slice(0, 7)}-01`;

  const prevMonthAnchor = new Date(Date.UTC(y, m - 2, 1));
  const prevY = prevMonthAnchor.getUTCFullYear();
  const prevM = prevMonthAnchor.getUTCMonth() + 1;
  const daysInPrevMonth = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  const prevDay = Math.min(d, daysInPrevMonth);
  const prevFrom = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
  const prevTo = `${prevY}-${String(prevM).padStart(2, "0")}-${String(prevDay).padStart(2, "0")}`;

  const [{ data: mtdRows }, { data: prevRows }] = await Promise.all([
    db
      .from("transactions")
      .select("amount, occurred_on")
      .eq("type", "expense")
      .is("deleted_at", null)
      .gte("occurred_on", mtdFrom)
      .lte("occurred_on", today),
    db
      .from("transactions")
      .select("amount")
      .eq("type", "expense")
      .is("deleted_at", null)
      .gte("occurred_on", prevFrom)
      .lte("occurred_on", prevTo),
  ]);

  const mtd = (mtdRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const prev = (prevRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const abs = mtd - prev;
  const pct = prev !== 0 ? abs / Math.abs(prev) : null;

  const byDay = new Map<string, number>();
  for (const r of mtdRows ?? []) {
    byDay.set(r.occurred_on, (byDay.get(r.occurred_on) ?? 0) + Number(r.amount));
  }
  let running = 0;
  const daily: number[] = [];
  for (let day = 1; day <= d; day++) {
    const key = `${today.slice(0, 7)}-${String(day).padStart(2, "0")}`;
    running += byDay.get(key) ?? 0;
    daily.push(running);
  }

  return {
    mtd,
    mtdRange: { from: mtdFrom, to: today },
    prev,
    prevRange: { from: prevFrom, to: prevTo },
    abs,
    pct,
    daily,
  };
}

// ------------------------------------------------------------------ //
// Allocation over time (stacked area).
// ------------------------------------------------------------------ //

export type AllocationSeriesId = "cash" | AssetClass;

export interface AllocationSeries {
  points: Array<{ date: string } & Partial<Record<AllocationSeriesId, number>>>;
  /** Ordered by SERIES_SLOT — this IS the stack order. Stacked-area
   * color validation is only meaningful when stack order matches slot
   * order (see the dataviz palette notes in globals.css), so this
   * array must never be re-sorted downstream. */
  seriesIds: AllocationSeriesId[];
  firstSnapshotOn: string | null;
}

export async function getAllocationSeries(days = 90): Promise<AllocationSeries> {
  const db = supabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const { data } = await db
    .from("net_worth_snapshots")
    .select("snapshot_on, cash_balance, breakdown")
    .gte("snapshot_on", wibDateString(cutoff))
    .order("snapshot_on", { ascending: true })
    .limit(400);

  const rows = data ?? [];
  if (rows.length === 0) {
    return { points: [], seriesIds: [], firstSnapshotOn: null };
  }

  // breakdown omits a class entirely when its holdings are zero (not
  // present as 0) — union the keys seen across every row so a class
  // that only appears on some days still gets a column, backfilled
  // with 0 on the rest. Without this the stacked area develops holes
  // and the stack visibly jumps when a class enters/exits.
  const keySet = new Set<string>(["cash"]);
  for (const r of rows) {
    const breakdown = (r.breakdown ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(breakdown)) {
      if (k in SERIES_SLOT) keySet.add(k);
    }
  }
  const seriesIds = Array.from(keySet).sort(
    (a, b) => SERIES_SLOT[a as SeriesKey] - SERIES_SLOT[b as SeriesKey],
  ) as AllocationSeriesId[];

  const points = rows.map((r) => {
    const breakdown = (r.breakdown ?? {}) as Record<string, number>;
    const point: { date: string } & Partial<Record<AllocationSeriesId, number>> = {
      date: r.snapshot_on,
    };
    for (const id of seriesIds) {
      point[id] = id === "cash" ? Number(r.cash_balance) : Number(breakdown[id] ?? 0);
    }
    return point;
  });

  return { points, seriesIds, firstSnapshotOn: rows[0].snapshot_on };
}
