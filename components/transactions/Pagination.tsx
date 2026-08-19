import type { TxFilters } from "@/lib/transactions-data";
import { txFiltersToSearchParams } from "@/lib/transactions-data";
import { ButtonLink } from "@/components/ui/button";

export function Pagination({
  filters,
  page,
  pageCount,
}: {
  filters: TxFilters;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  const hrefFor = (p: number) => `/transactions?${txFiltersToSearchParams({ ...filters, page: p })}`;

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-xs text-ink-muted">
        Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <ButtonLink href={hrefFor(page - 1)} variant="secondary" size="sm">
            ← Previous
          </ButtonLink>
        ) : (
          <span className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-muted">← Previous</span>
        )}
        {page < pageCount ? (
          <ButtonLink href={hrefFor(page + 1)} variant="secondary" size="sm">
            Next →
          </ButtonLink>
        ) : (
          <span className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-muted">Next →</span>
        )}
      </div>
    </div>
  );
}
