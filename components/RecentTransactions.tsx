import Link from "next/link";
import { deleteTransactionAction } from "@/app/actions";
import type { RecentTransaction } from "@/lib/dashboard-data";

const idr = new Intl.NumberFormat("id-ID");

const TYPE_LABEL: Record<string, string> = {
  income: "Income",
  expense: "Expense",
  asset_buy: "Buy",
  asset_sell: "Sell",
  transfer: "Transfer",
};

const TYPE_COLOR: Record<string, string> = {
  income: "text-green-700",
  expense: "text-red-700",
  asset_buy: "text-amber-700",
  asset_sell: "text-amber-700",
  transfer: "text-neutral-500",
};

export function RecentTransactions({ transactions }: { transactions: RecentTransaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-neutral-400">No transactions yet — text something to the Telegram bot.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-neutral-500">
          <th className="py-2 font-medium">Date</th>
          <th className="py-2 font-medium">Type</th>
          <th className="py-2 font-medium">Detail</th>
          <th className="py-2 font-medium">Account</th>
          <th className="py-2 text-right font-medium">Amount</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((t) => (
          <tr key={t.id} className="border-b border-neutral-100 last:border-0">
            <td className="py-2 whitespace-nowrap text-neutral-500">{t.occurredOn}</td>
            <td className={`py-2 font-medium ${TYPE_COLOR[t.type] ?? ""}`}>{TYPE_LABEL[t.type] ?? t.type}</td>
            <td className="py-2">
              {t.categoryLabel ?? ""}
              {t.assetSymbol ? `${t.categoryLabel ? " · " : ""}${t.quantity} ${t.assetSymbol}` : ""}
              {t.note ? ` · ${t.note}` : ""}
            </td>
            <td className="py-2 text-neutral-500">{t.accountName}</td>
            <td className="py-2 text-right font-mono">{idr.format(t.amount)}</td>
            <td className="py-2 pl-2 text-right whitespace-nowrap">
              <Link href={`/transactions/${t.id}/edit`} className="text-neutral-500 hover:text-neutral-900">
                edit
              </Link>{" "}
              <form action={deleteTransactionAction} className="inline">
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="text-neutral-500 hover:text-red-700">
                  delete
                </button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
