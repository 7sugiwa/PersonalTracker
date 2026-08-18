"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { EmptyState } from "@/components/charts/NetWorthChart";
import { idrTooltipFormatter } from "@/lib/format";

const CLASS_LABELS: Record<string, string> = {
  gold: "Gold",
  us_equity: "US Equity",
  idx_equity: "IDX Equity",
  crypto: "Crypto",
};

const COLORS = ["#f59e0b", "#0ea5e9", "#16a34a", "#a855f7", "#dc2626"];

export function AllocationChart({ breakdown }: { breakdown: Record<string, number> }) {
  const data = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: CLASS_LABELS[k] ?? k, value: v }));

  if (data.length === 0) {
    return <EmptyState label="No holdings valued yet — run the price cron first." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={idrTooltipFormatter} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
