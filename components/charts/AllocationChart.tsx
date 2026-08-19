"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { CLASS_LABELS, SERIES_SLOT, seriesVar, type SeriesKey } from "@/components/charts/chart-theme";
import { idr as fmtIdr } from "@/lib/format";

export function AllocationChart({ breakdown }: { breakdown: Record<string, number> }) {
  const data = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    // Fixed slot order (not the object's own key order) so a class
    // keeps the same color across renders even as siblings appear or
    // disappear — matches the entity->slot binding used everywhere
    // else (chart-theme.ts).
    .sort(([a], [b]) => {
      const sa = SERIES_SLOT[a as SeriesKey] ?? 99;
      const sb = SERIES_SLOT[b as SeriesKey] ?? 99;
      return sa - sb;
    })
    .map(([k, v]) => ({ key: k, name: CLASS_LABELS[k] ?? k, value: v }));

  if (data.length === 0) {
    return <EmptyState title="No holdings valued yet" hint="Run the price cron first." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.key} fill={seriesVar((d.key as SeriesKey) in SERIES_SLOT ? (d.key as SeriesKey) : "cash")} />
          ))}
        </Pie>
        <Tooltip content={(p) => <ChartTooltip {...p} format={(v) => `Rp${fmtIdr(v)}`} />} />
        <Legend
          formatter={(value) => <span className="text-xs text-ink-secondary">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
