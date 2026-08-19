import {
  parseTxFilters,
  txFiltersToSearchParams,
  getTransactionsPage,
  getTransactionsSummary,
  getFilterOptions,
} from "@/lib/transactions-data";
import { FilterBar } from "@/components/transactions/FilterBar";
import { SummaryStrip } from "@/components/transactions/SummaryStrip";
import { LedgerTable } from "@/components/transactions/LedgerTable";
import { Pagination } from "@/components/transactions/Pagination";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/section";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseTxFilters(sp);

  const [{ rows, total, page, pageCount }, summary, options] = await Promise.all([
    getTransactionsPage(filters),
    getTransactionsSummary(filters),
    getFilterOptions(),
  ]);

  const returnTo = `/transactions?${txFiltersToSearchParams(filters)}`;

  return (
    <div>
      <PageHeader title="Transactions" />

      <FilterBar filters={filters} options={options} />
      <SummaryStrip summary={summary} />

      <Card>
        <CardBody>
          <LedgerTable rows={rows} returnTo={returnTo} />
          <Pagination filters={filters} page={page} pageCount={pageCount} />
        </CardBody>
      </Card>

      <p className="mt-2 text-xs text-ink-muted">{total} matching transactions total.</p>
    </div>
  );
}
