"use client";

import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { rpCompact, monthLabel, idr as fmtIdr } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { CHART_GRID, CHART_AXIS, CHART_TICK } from "@/components/charts/chart-theme";

interface Row {
  month: string;
  income: number;
  expense: number;
}

function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(lastDay).padStart(2, "0")}` };
}

/** Income/expense is a polarity pair, not a categorical series — money
 * in/out is universally read as green/red, so this is the one
 * deliberate use of the positive/negative status colors as series
 * identity (see globals.css comment). Mitigated by shipping a legend
 * AND direct value labels, so hue never carries the meaning alone. */
export function IncomeExpenseChart({ data }: { data: Row[] }) {
  const router = useRouter();
  const hasAny = data.some((d) => d.income > 0 || d.expense > 0);

  function goToMonth(ym: string) {
    const { from, to } = monthRange(ym);
    router.push(`/transactions?from=${from}&to=${to}`);
  }

  if (!hasAny) {
    return <EmptyState title="No income or expenses logged yet" />;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={CHART_TICK}
            stroke={CHART_AXIS}
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
            cursor={{ fill: "var(--surface-2)" }}
            content={(p) => (
              <ChartTooltip {...p} format={(v) => `Rp${fmtIdr(v)}`} labelFormat={monthLabel} />
            )}
          />
          <Legend
            formatter={(value) => <span className="text-xs text-ink-secondary">{value}</span>}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill="var(--positive-mark)"
            radius={[4, 4, 0, 0]}
            className="cursor-pointer"
            onClick={(d) => {
              const month = (d?.payload as Row | undefined)?.month;
              if (month) goToMonth(month);
            }}
          >
            <LabelList
              dataKey="income"
              position="top"
              formatter={(v: unknown) => {
                const n = Number(v);
                return n > 0 ? rpCompact(n) : "";
              }}
              style={{ fill: "var(--text-muted)", fontSize: 10 }}
            />
          </Bar>
          <Bar
            dataKey="expense"
            name="Expense"
            fill="var(--negative-mark)"
            radius={[4, 4, 0, 0]}
            className="cursor-pointer"
            onClick={(d) => {
              const month = (d?.payload as Row | undefined)?.month;
              if (month) goToMonth(month);
            }}
          >
            <LabelList
              dataKey="expense"
              position="top"
              formatter={(v: unknown) => {
                const n = Number(v);
                return n > 0 ? rpCompact(n) : "";
              }}
              style={{ fill: "var(--text-muted)", fontSize: 10 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Keyboard/screen-reader path to the same drilldown a bar click
       * gives a mouse user — <Bar onClick> has no accessible role. */}
      <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
        Jump to month
        <select
          className="rounded-md border border-line bg-surface-inset px-2 py-1 text-xs text-ink-secondary focus:border-ring focus:outline-none"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) goToMonth(e.target.value);
          }}
        >
          <option value="" disabled>
            Select…
          </option>
          {data.map((d) => (
            <option key={d.month} value={d.month}>
              {monthLabel(d.month)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
