"use client";

import { useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { rpCompact, shortDate, longDate, idr as fmtIdr } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { InsufficientHistory } from "@/components/ui/insufficient-history";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { CHART_GRID, CHART_AXIS, CHART_TICK } from "@/components/charts/chart-theme";
import type { HistoryStatus } from "@/lib/history";

interface Point {
  date: string;
  netWorth: number;
}

/** Single series only — netWorth = cash + holdings, so plotting the
 * total against its own components puts them on one scale and the
 * total dwarfs the parts. Composition lives in its own card
 * (allocation over time). No legend: the card title already names the
 * one series. */
export function NetWorthChart({ data, history }: { data: Point[]; history: HistoryStatus }) {
  const gradientId = useId();

  if (data.length === 0) {
    return (
      <EmptyState
        title="No net worth snapshots yet"
        hint="The daily price cron writes one snapshot per day."
      />
    );
  }

  if (!history.ok) {
    return <InsufficientHistory have={history.have} need={history.need} since={history.since} />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`nw-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          content={(p) => (
            <ChartTooltip {...p} format={(v) => `Rp${fmtIdr(v)}`} labelFormat={longDate} />
          )}
        />
        <Area
          type="monotone"
          dataKey="netWorth"
          name="Net worth"
          stroke="var(--series-1)"
          strokeWidth={2}
          fill={`url(#nw-${gradientId})`}
          dot={false}
          activeDot={{ r: 3, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
