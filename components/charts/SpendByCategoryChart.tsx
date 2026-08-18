"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { EmptyState } from "@/components/charts/NetWorthChart";
import { idrTooltipFormatter } from "@/lib/format";

interface Row {
  category: string;
  total: number;
}

export function SpendByCategoryChart({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return <EmptyState label="No expenses logged this month yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={100} />
        <Tooltip formatter={idrTooltipFormatter} />
        <Bar dataKey="total" fill="#171717" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
