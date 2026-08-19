import Link from "next/link";
import { cx } from "@/components/ui/cx";

const RANGES = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: 3650 },
] as const;

/** Server-rendered — no client JS needed for a set of links that just
 * change ?nw= on the current page. */
export function RangeChips({ active }: { active: number }) {
  return (
    <div className="flex items-center gap-1">
      {RANGES.map((r) => (
        <Link
          key={r.days}
          href={`/?nw=${r.days}`}
          className={cx(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            active === r.days
              ? "bg-surface-2 text-ink"
              : "text-ink-muted hover:bg-surface-2 hover:text-ink-secondary",
          )}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}
