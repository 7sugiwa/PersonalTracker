const idr = new Intl.NumberFormat("id-ID");

interface Row {
  id: string;
  name: string;
  kind: string;
  balance: number;
}

export function AccountsTable({ accounts }: { accounts: Row[] }) {
  if (accounts.length === 0) {
    return <p className="text-sm text-neutral-400">No accounts seeded yet — run `npm run seed`.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-neutral-500">
          <th className="py-2 font-medium">Account</th>
          <th className="py-2 font-medium">Kind</th>
          <th className="py-2 pr-1 text-right font-medium">Balance (IDR)</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((a) => (
          <tr key={a.id} className="border-b border-neutral-100 last:border-0">
            <td className="py-2">{a.name}</td>
            <td className="py-2 text-neutral-500">{a.kind}</td>
            <td className="py-2 pr-1 text-right font-mono">{idr.format(a.balance)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
