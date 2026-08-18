"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { idrTooltipFormatter } from "@/lib/format";

interface Point {
  date: string;
  cash: number;
  holdings: number;
  netWorth: number;
}

function formatCompactIdr(v: number) {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
}

export function NetWorthChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <EmptyState label="No net worth snapshots yet — the daily price cron writes one per day." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis tickFormatter={formatCompactIdr} tick={{ fontSize: 11 }} width={56} />
        <Tooltip
          formatter={idrTooltipFormatter}
          labelFormatter={(l) => `Date: ${l}`}
        />
        <Legend />
        <Line type="monotone" dataKey="netWorth" name="Net worth" stroke="#171717" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="cash" name="Cash" stroke="#0ea5e9" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="holdings" name="Holdings" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-neutral-400">
      {label}
    </div>
  );
}
