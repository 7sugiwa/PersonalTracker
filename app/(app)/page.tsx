import { Suspense } from "react";
import { StalenessBanner } from "@/components/StalenessBanner";
import { KpiSection } from "@/components/dashboard/KpiSection";
import { NetWorthChartCard } from "@/components/dashboard/NetWorthChartCard";
import { SpendCard } from "@/components/dashboard/SpendCard";
import { AllocationCard } from "@/components/dashboard/AllocationCard";
import { AllocationOverTimeCard } from "@/components/dashboard/AllocationOverTimeCard";
import { IncomeExpenseCard } from "@/components/dashboard/IncomeExpenseCard";
import { AccountsCard } from "@/components/dashboard/AccountsCard";
import { TransactionsCard } from "@/components/dashboard/TransactionsCard";
import { PageHeader } from "@/components/ui/section";
import { StatTileSkeleton, ChartCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

const VALID_RANGES = new Set([30, 90, 365, 3650]);

// Each card below fetches its own data and is wrapped in its own
// Suspense boundary — the page no longer waits on one Promise.all for
// its slowest query; the KPI row paints as soon as ITS query lands,
// independent of e.g. the transactions table. Sibling boundaries still
// start their fetches in parallel, so the DB round-trip count is
// unchanged.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ nw?: string }>;
}) {
  const { nw } = await searchParams;
  const nwDays = VALID_RANGES.has(Number(nw)) ? Number(nw) : 90;

  return (
    <div>
      <PageHeader title="Overview" />

      <Suspense fallback={null}>
        <StalenessBanner />
      </Suspense>

      <Suspense
        fallback={
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </div>
        }
      >
        <KpiSection />
      </Suspense>

      <Suspense fallback={<ChartCardSkeleton />}>
        <NetWorthChartCard nwDays={nwDays} />
      </Suspense>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Suspense fallback={<ChartCardSkeleton />}>
          <SpendCard />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton />}>
          <AllocationCard />
        </Suspense>
      </div>

      <Suspense fallback={<ChartCardSkeleton />}>
        <AllocationOverTimeCard />
      </Suspense>

      <Suspense fallback={<ChartCardSkeleton />}>
        <IncomeExpenseCard />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <AccountsCard />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={10} />}>
        <TransactionsCard />
      </Suspense>
    </div>
  );
}
