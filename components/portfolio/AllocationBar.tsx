import type { Position } from "@/lib/positions-data";
import { CLASS_LABELS, SERIES_SLOT, seriesVar, type SeriesKey } from "@/components/charts/chart-theme";
import { pct } from "@/lib/format";

/** 100% stacked horizontal bar — preferred over a donut here because
 * donuts read poorly at close values, and the positions table below
 * already carries a Weight column with its own micro-bar, so this is
 * a summary, not the only source of the numbers. */
export function AllocationBar({ positions }: { positions: Position[] }) {
  const byClass = new Map<string, number>();
  let total = 0;
  for (const p of positions) {
    if (p.marketValueIdr === null) continue;
    byClass.set(p.assetClass, (byClass.get(p.assetClass) ?? 0) + p.marketValueIdr);
    total += p.marketValueIdr;
  }

  if (total === 0) return null;

  const segments = Array.from(byClass.entries())
    .sort(([a], [b]) => (SERIES_SLOT[a as SeriesKey] ?? 99) - (SERIES_SLOT[b as SeriesKey] ?? 99))
    .map(([key, value]) => ({ key, value, share: value / total }));

  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.key}
            style={{ width: `${s.share * 100}%`, background: seriesVar((s.key as SeriesKey) in SERIES_SLOT ? (s.key as SeriesKey) : "cash") }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: seriesVar((s.key as SeriesKey) in SERIES_SLOT ? (s.key as SeriesKey) : "cash") }}
            />
            {CLASS_LABELS[s.key] ?? s.key} · {pct(s.share)}
          </div>
        ))}
      </div>
    </div>
  );
}
