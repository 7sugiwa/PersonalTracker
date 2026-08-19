import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { updateTransactionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export default async function EditTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
    ? rawReturnTo
    : "/transactions";

  const db = supabase();
  const { data: tx } = await db
    .from("transactions")
    .select("id, type, amount, note, occurred_on")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tx) notFound();

  return (
    <div className="mx-auto max-w-md">
      <Link href={returnTo} className="mb-4 inline-block text-sm text-ink-secondary hover:text-ink">
        ← Back
      </Link>
      <h1 className="mb-1 text-lg font-semibold text-ink">Edit transaction</h1>
      <p className="mb-4 text-sm text-ink-secondary">
        {tx.type} · {tx.occurred_on}
      </p>
      <form action={updateTransactionAction} className="space-y-3">
        <input type="hidden" name="id" value={tx.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div>
          <Label htmlFor="amount">Amount (IDR)</Label>
          <Input
            id="amount"
            type="number"
            name="amount"
            defaultValue={tx.amount}
            min={1}
            step="any"
            required
          />
        </div>
        <div>
          <Label htmlFor="note">Note</Label>
          <Input id="note" type="text" name="note" defaultValue={tx.note ?? ""} />
        </div>
        <Button type="submit" variant="primary" className="w-full">
          Save
        </Button>
      </form>
    </div>
  );
}
