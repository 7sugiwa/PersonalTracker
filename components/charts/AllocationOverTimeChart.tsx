"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { AllocationSeries } from "@/lib/dashboard-data";
import { rpCompact, shortDate, longDate, idr as fmtIdr, pct } from "@/lib/format";
import { CLASS_LABELS, seriesVar } from "@/components/charts/chart-theme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { CHART_GRID, CHART_AXIS, CHART_TICK } from "@/components/charts/chart-theme";
import { EmptyState } from "@/components/ui/empty-state";
import type { HistoryStatus } from "@/lib/history";

export function AllocationOverTimeChart({
  series,
  history,
}: {
  series: AllocationSeries;
  history: HistoryStatus;
}) {
  if (series.points.length === 0) {
    return <EmptyState title="No allocation history yet" hint="The daily price cron writes one snapshot per day." />;
  }

  // Fewer than 2 snapshots can't show a trend — degrade to a still-
  // useful view of the one day we do have, rather than a bare
  // placeholder. Same 100%-stacked-bar form as the portfolio page's
  // AllocationBar, just built from breakdown values instead of
  // positions.
  if (!history.ok) {
    const latest = series.points[series.points.length - 1];
    const total = series.seriesIds.reduce((s, id) => s + (latest[id] ?? 0), 0);
    if (total <= 0) {
      return <EmptyState title="No holdings valued yet" hint="Run the price cron first." />;
    }
    return (
      <div className="flex h-[280px] flex-col justify-center gap-3">
        <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
          {series.seriesIds.map((id) => {
            const v = latest[id] ?? 0;
            if (v <= 0) return null;
            return <div key={id} style={{ width: `${(v / total) * 100}%`, background: seriesVar(id) }} />;
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {series.seriesIds.map((id) => {
            const v = latest[id] ?? 0;
            if (v <= 0) return null;
            return (
              <div key={id} className="flex items-center gap-1.5 text-xs text-ink-secondary">
                <span className="h-2 w-2 rounded-full" style={{ background: seriesVar(id) }} />
                {CLASS_LABELS[id] ?? id} · {pct(v / total)}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-ink-muted">
          Showing {longDate(latest.date)} only — not enough history for a trend yet ({history.have} of{" "}
          {history.need} days).
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={series.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={CHART_TICK}
          stroke={CHART_AXIS}
          minTickGap={32}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => rpCompact(v)}
          tick={CHART_TICK}
          stroke={CHART_AXIS}
          width={56}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ stroke: CHART_AXIS, strokeWidth: 1 }}
          content={(p) => <ChartTooltip {...p} format={(v) => `Rp${fmtIdr(v)}`} labelFormat={longDate} />}
        />
        <Legend formatter={(value) => <span className="text-xs text-ink-secondary">{value}</span>} />
        {series.seriesIds.map((id) => (
          <Area
            key={id}
            type="monotone"
            dataKey={id}
            name={CLASS_LABELS[id] ?? id}
            stackId="allocation"
            stroke={seriesVar(id)}
            fill={seriesVar(id)}
            fillOpacity={0.85}
            strokeWidth={1}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
