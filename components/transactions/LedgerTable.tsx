import Link from "next/link";
import type { LedgerRow } from "@/lib/transactions-data";
import { rp } from "@/lib/format";
import { Table, THead, TBody, TR, TH, TDNum } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

const TYPE_LABEL: Record<string, string> = {
  income: "Income",
  expense: "Expense",
  asset_buy: "Buy",
  asset_sell: "Sell",
  transfer: "Transfer",
};

const TYPE_TONE: Record<string, "positive" | "negative" | "warning" | "neutral"> = {
  income: "positive",
  expense: "negative",
  asset_buy: "warning",
  asset_sell: "warning",
  transfer: "neutral",
};

export function LedgerTable({ rows, returnTo }: { rows: LedgerRow[]; returnTo: string }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No transactions match these filters"
        hint="Try widening the date range or clearing a filter."
        height={160}
      />
    );
  }

  return (
    <Table>
      <THead>
        <TH>Date</TH>
        <TH>Type</TH>
        <TH>Detail</TH>
        <TH>Account</TH>
        <TH className="text-right">Amount</TH>
        <TH></TH>
      </THead>
      <TBody>
        {rows.map((t) => (
          <TR key={t.id}>
            <td className="py-2 pr-3 whitespace-nowrap text-ink-secondary">{t.occurredOn}</td>
            <td className="py-2 pr-3">
              <Badge tone={TYPE_TONE[t.type] ?? "neutral"}>{TYPE_LABEL[t.type] ?? t.type}</Badge>
            </td>
            <td className="py-2 pr-3 text-ink">
              {t.categoryLabel ?? ""}
              {t.assetSymbol ? `${t.categoryLabel ? " · " : ""}${t.quantity} ${t.assetSymbol}` : ""}
              {t.note ? ` · ${t.note}` : ""}
            </td>
            <td className="py-2 pr-3 text-ink-secondary">
              {t.accountName}
              {t.counterAccountName && ` → ${t.counterAccountName}`}
            </td>
            <TDNum>{rp(t.amount)}</TDNum>
            <td className="py-2 pl-2 text-right whitespace-nowrap">
              <Link
                href={`/transactions/${t.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                className="text-ink-secondary transition-colors hover:text-ink"
              >
                edit
              </Link>{" "}
              <Link
                href={`/transactions/${t.id}/delete?returnTo=${encodeURIComponent(returnTo)}`}
                className="text-ink-secondary transition-colors hover:text-negative"
              >
                delete
              </Link>
            </td>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
