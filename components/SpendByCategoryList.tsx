import { wibDateString } from "@/lib/wib";
import { BarList } from "@/components/ui/bar-list";
import { EmptyState } from "@/components/ui/empty-state";

interface Row {
  categoryId: string | null;
  label: string;
  total: number;
}

/** Replaces the old recharts SpendByCategoryChart. An <ol> of real
 * links buys keyboard/middle-click/screen-reader drilldown that a
 * <Bar onClick> can't, and long category labels wrap instead of being
 * clipped by a fixed YAxis width. */
export function SpendByCategoryList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No expenses logged this month yet" height={200} />;
  }

  const today = wibDateString();
  const monthStart = `${today.slice(0, 7)}-01`;

  return (
    <BarList
      rows={rows.map((r) => ({
        key: r.categoryId ?? r.label,
        label: r.label,
        value: r.total,
        href: r.categoryId
          ? `/transactions?type=expense&category=${r.categoryId}&from=${monthStart}&to=${today}`
          : `/transactions?type=expense&from=${monthStart}&to=${today}`,
      }))}
    />
  );
}
