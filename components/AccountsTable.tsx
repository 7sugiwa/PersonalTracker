import Link from "next/link";
import { rp } from "@/lib/format";
import { Table, THead, TBody, TR, TH, TDNum } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

interface Row {
  id: string;
  name: string;
  kind: string;
  balance: number;
}

export function AccountsTable({ accounts }: { accounts: Row[] }) {
  if (accounts.length === 0) {
    return <EmptyState title="No accounts seeded yet" hint="Run `npm run seed`." height={120} />;
  }

  return (
    <Table>
      <THead>
        <TH>Account</TH>
        <TH>Kind</TH>
        <TH className="text-right">Balance (IDR)</TH>
      </THead>
      <TBody>
        {accounts.map((a) => (
          <TR key={a.id}>
            <td className="py-2 pr-3">
              <Link
                href={`/transactions?account=${a.id}`}
                className="text-ink transition-colors hover:text-ring"
              >
                {a.name}
              </Link>
            </td>
            <td className="py-2 pr-3 text-ink-secondary">{a.kind}</td>
            <TDNum>{rp(a.balance)}</TDNum>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
