import Link from "next/link";
import { rp } from "@/lib/format";

export interface BarListRow {
  key: string;
  label: string;
  value: number;
  href?: string;
}

/** Not a recharts component. An <ol> of rows: label, a width:%-driven
 * bar, value — each row optionally a real <a>. Replaces
 * SpendByCategoryChart because a real link buys keyboard navigation,
 * middle-click, and screen-reader support that a <Bar onClick> can't;
 * it also lets long category labels wrap instead of being clipped by a
 * fixed YAxis width. */
export function BarList({ rows }: { rows: BarListRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <ol className="space-y-2">
      {rows.map((row) => {
        const pctWidth = Math.max(2, (row.value / max) * 100);
        const content = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-ink">{row.label}</span>
              <span className="shrink-0 font-mono tabular-nums text-ink-secondary">
                {rp(row.value)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-series-1"
                style={{ width: `${pctWidth}%` }}
              />
            </div>
          </>
        );

        return (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                className="block rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-surface-2/60"
              >
                {content}
              </Link>
            ) : (
              <div className="px-1 py-0.5 -mx-1">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
