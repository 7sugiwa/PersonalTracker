"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { EmptyState } from "@/components/charts/NetWorthChart";
import { idrTooltipFormatter } from "@/lib/format";

interface Row {
  month: string;
  income: number;
  expense: number;
}

function formatCompactIdr(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
}

export function IncomeExpenseChart({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return <EmptyState label="No income or expenses logged yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatCompactIdr} tick={{ fontSize: 11 }} width={56} />
        <Tooltip formatter={idrTooltipFormatter} />
        <Legend />
        <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Expense" fill="#dc2626" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
