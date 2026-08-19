import type { TxSummary } from "@/lib/transactions-data";
import { rp } from "@/lib/format";

export function SummaryStrip({ summary }: { summary: TxSummary }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryItem label="Matching" value={String(summary.count)} />
      <SummaryItem label="Income" value={rp(summary.income)} tone="positive" />
      <SummaryItem label="Expense" value={rp(summary.expense)} tone="negative" />
      <SummaryItem label="Net" value={rp(summary.net)} />
    </div>
  );
}

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const toneClass = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
