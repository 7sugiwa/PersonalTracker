// Same reasoning as app/page.tsx: reads live, per-user Supabase data
// behind the proxy.ts auth gate, and would otherwise fail at build time
// in any environment without real credentials.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { updateTransactionAction } from "@/app/actions";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabase();
  const { data: tx } = await db
    .from("transactions")
    .select("id, type, amount, note, occurred_on")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tx) notFound();

  return (
    <div className="mx-auto max-w-md p-6">
      <Link href="/" className="mb-4 inline-block text-sm text-neutral-500 hover:text-neutral-900">
        ← Back to dashboard
      </Link>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Edit transaction</h1>
      <p className="mb-4 text-sm text-neutral-500">
        {tx.type} · {tx.occurred_on}
      </p>
      <form action={updateTransactionAction} className="space-y-3">
        <input type="hidden" name="id" value={tx.id} />
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600">Amount (IDR)</span>
          <input
            type="number"
            name="amount"
            defaultValue={tx.amount}
            min={1}
            step="any"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600">Note</span>
          <input
            type="text"
            name="note"
            defaultValue={tx.note ?? ""}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Save
        </button>
      </form>
    </div>
  );
}
