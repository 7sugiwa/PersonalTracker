// Always render per-request. This page reads live financial data behind
// the proxy.ts auth gate — it must never be statically generated (which
// would also fail at build time in any environment without real
// Supabase credentials, since Next.js prerenders static pages at build
// time) or cached across users/requests.
export const dynamic = "force-dynamic";

import {
  getNetWorthSeries,
  getLatestNetWorth,
  getSpendByCategory,
  getIncomeVsExpenseSeries,
  getAccountBalances,
  getRecentTransactions,
} from "@/lib/dashboard-data";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { SpendByCategoryChart } from "@/components/charts/SpendByCategoryChart";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { AllocationChart } from "@/components/charts/AllocationChart";
import { AccountsTable } from "@/components/AccountsTable";
import { RecentTransactions } from "@/components/RecentTransactions";
import { StalenessBanner } from "@/components/StalenessBanner";

const idr = new Intl.NumberFormat("id-ID");

export default async function DashboardPage() {
  const [netWorthSeries, latest, spendByCategory, incomeExpense, accounts, transactions] =
    await Promise.all([
      getNetWorthSeries(90),
      getLatestNetWorth(),
      getSpendByCategory(),
      getIncomeVsExpenseSeries(6),
      getAccountBalances(),
      getRecentTransactions(25),
    ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">PersonalTracker</h1>
        <form action="/api/logout" method="POST">
          <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-900">
            Log out
          </button>
        </form>
      </div>

      <StalenessBanner />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Net worth" value={latest?.netWorth ?? 0} />
        <SummaryCard label="Cash" value={latest?.cash ?? 0} />
        <SummaryCard label="Holdings" value={latest?.holdings ?? 0} />
      </div>

      <Card title="Net worth over time">
        <NetWorthChart data={netWorthSeries} />
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Spend by category (this month)">
          <SpendByCategoryChart data={spendByCategory} />
        </Card>
        <Card title="Asset allocation">
          <AllocationChart breakdown={latest?.breakdown ?? {}} />
        </Card>
      </div>

      <Card title="Income vs expense (last 6 months)">
        <IncomeExpenseChart data={incomeExpense} />
      </Card>

      <Card title="Accounts">
        <AccountsTable accounts={accounts} />
      </Card>

      <Card title="Recent transactions">
        <RecentTransactions transactions={transactions} />
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-neutral-900">Rp{idr.format(value)}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-700">{title}</h2>
      {children}
    </div>
  );
}
