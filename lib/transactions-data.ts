import "server-only";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { TransactionType } from "@/lib/db-types";

export const TX_PAGE_SIZE = 50;

const TX_TYPES: readonly TransactionType[] = [
  "income",
  "expense",
  "asset_buy",
  "asset_sell",
  "transfer",
];

export interface TxFilters {
  types: TransactionType[];
  accountId: string | null;
  categoryId: string | null;
  assetId: string | null;
  from: string | null;
  to: string | null;
  q: string | null;
  page: number;
}

// Every field uses .catch() to a safe default — a hand-mangled URL
// (?page=abc&type=nonsense) must degrade to the default filter, never
// 500 a page that's already behind a login.
const uuidField = z.string().uuid().nullable().catch(null);
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .catch(null);

function firstOf(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Parses raw URL searchParams (as Next hands them to a page) into a
 * validated filter object. Repeated `?type=` keys arrive as an array —
 * that's why `type` is the multi-value filter and everything else is
 * single-value. */
export function parseTxFilters(sp: Record<string, string | string[] | undefined>): TxFilters {
  const rawTypes = sp.type;
  const typesArray = Array.isArray(rawTypes) ? rawTypes : rawTypes ? [rawTypes] : [];
  const types = typesArray.filter((t): t is TransactionType =>
    (TX_TYPES as readonly string[]).includes(t),
  );

  const page = z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1))
    .catch(1)
    .parse(firstOf(sp.page) ?? "1");

  return {
    types,
    accountId: uuidField.parse(firstOf(sp.account) ?? null),
    categoryId: uuidField.parse(firstOf(sp.category) ?? null),
    assetId: uuidField.parse(firstOf(sp.asset) ?? null),
    from: dateField.parse(firstOf(sp.from) || null),
    to: dateField.parse(firstOf(sp.to) || null),
    q: firstOf(sp.q)?.trim() || null,
    page,
  };
}

/** The single source of truth for every drilldown link in the app —
 * build a /transactions URL from a (partial) filter so the query-param
 * contract lives in exactly one place. */
export function txFiltersToSearchParams(f: Partial<TxFilters>): URLSearchParams {
  const params = new URLSearchParams();
  for (const t of f.types ?? []) params.append("type", t);
  if (f.accountId) params.set("account", f.accountId);
  if (f.categoryId) params.set("category", f.categoryId);
  if (f.assetId) params.set("asset", f.assetId);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  if (f.q) params.set("q", f.q);
  if (f.page && f.page > 1) params.set("page", String(f.page));
  return params;
}

export interface LedgerRow {
  id: string;
  type: TransactionType;
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
  unitPrice: number | null;
}

const LEDGER_SELECT =
  "id, type, amount, note, occurred_on, quantity, unit_price, category_id, asset_id, account_id, counter_account_id, accounts!transactions_account_id_fkey(name), counter_account:accounts!transactions_counter_account_id_fkey(name), categories(label), assets(symbol)";

function toLedgerRow(t: Record<string, unknown>): LedgerRow {
  return {
    id: t.id as string,
    type: t.type as TransactionType,
    amount: Number(t.amount),
    note: t.note as string | null,
    occurredOn: t.occurred_on as string,
    accountName: (t.accounts as { name: string } | null)?.name ?? "?",
    counterAccountName: (t.counter_account as { name: string } | null)?.name ?? null,
    categoryId: t.category_id as string | null,
    categoryLabel: (t.categories as { label: string } | null)?.label ?? null,
    assetId: t.asset_id as string | null,
    assetSymbol: (t.assets as { symbol: string } | null)?.symbol ?? null,
    quantity: t.quantity ? Number(t.quantity) : null,
    unitPrice: t.unit_price ? Number(t.unit_price) : null,
  };
}

// Strips PostgREST ilike wildcards from user input before
// interpolating — an unescaped % or _ changes the match. This column
// is never routed through .or() (which has its own, stricter
// comma/paren escaping needs), so this is the only escaping it needs.
function escapeIlike(q: string): string {
  return q.replace(/[%_]/g, "");
}

export async function getTransactionsPage(
  f: TxFilters,
): Promise<{ rows: LedgerRow[]; total: number; page: number; pageCount: number }> {
  const db = supabase();
  const offset = (f.page - 1) * TX_PAGE_SIZE;

  let query = db.from("transactions").select(LEDGER_SELECT, { count: "exact" }).is("deleted_at", null);
  if (f.types.length > 0) query = query.in("type", f.types);
  if (f.accountId) query = query.or(`account_id.eq.${f.accountId},counter_account_id.eq.${f.accountId}`);
  if (f.categoryId) query = query.eq("category_id", f.categoryId);
  if (f.assetId) query = query.eq("asset_id", f.assetId);
  if (f.from) query = query.gte("occurred_on", f.from);
  if (f.to) query = query.lte("occurred_on", f.to);
  if (f.q) query = query.ilike("note", `%${escapeIlike(f.q)}%`);

  const { data, count } = await query
    // Stable three-key sort: without the `id` tiebreaker, two rows
    // sharing an occurred_at can swap between page requests —
    // duplicating one row and silently hiding another.
    .order("occurred_on", { ascending: false })
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + TX_PAGE_SIZE - 1);

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / TX_PAGE_SIZE));

  return {
    rows: (data ?? []).map((t) => toLedgerRow(t as Record<string, unknown>)),
    total,
    page: f.page,
    pageCount,
  };
}

export interface TxSummary {
  count: number;
  income: number;
  expense: number;
  net: number;
}

export async function getTransactionsSummary(f: TxFilters): Promise<TxSummary> {
  const db = supabase();
  let query = db.from("transactions").select("type, amount", { count: "exact" }).is("deleted_at", null);
  if (f.types.length > 0) query = query.in("type", f.types);
  if (f.accountId) query = query.or(`account_id.eq.${f.accountId},counter_account_id.eq.${f.accountId}`);
  if (f.categoryId) query = query.eq("category_id", f.categoryId);
  if (f.assetId) query = query.eq("asset_id", f.assetId);
  if (f.from) query = query.gte("occurred_on", f.from);
  if (f.to) query = query.lte("occurred_on", f.to);
  if (f.q) query = query.ilike("note", `%${escapeIlike(f.q)}%`);

  const { data, count } = await query;

  let income = 0;
  let expense = 0;
  for (const row of data ?? []) {
    const amount = Number(row.amount);
    if (row.type === "income") income += amount;
    else if (row.type === "expense") expense += amount;
  }

  return { count: count ?? 0, income, expense, net: income - expense };
}

export interface FilterOptions {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; label: string }>;
  assets: Array<{ id: string; symbol: string; displayName: string }>;
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const db = supabase();
  const [{ data: accounts }, { data: categories }, { data: assets }] = await Promise.all([
    db.from("accounts").select("id, name").is("archived_at", null).order("name"),
    db.from("categories").select("id, label").is("archived_at", null).order("sort"),
    db.from("assets").select("id, symbol, display_name").eq("is_active", true).order("symbol"),
  ]);

  return {
    accounts: accounts ?? [],
    categories: categories ?? [],
    assets: (assets ?? []).map((a) => ({
      id: a.id,
      symbol: a.symbol,
      displayName: a.display_name,
    })),
  };
}
