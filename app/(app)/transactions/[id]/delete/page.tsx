import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { deleteTransactionAction } from "@/app/actions";
import { rp } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

// A one-click inline delete button is one misclick from destroying a
// row with no way back (the underlying delete IS reversible in the DB —
// it's a soft delete — but there's no UI to undo it). This confirm step
// costs one extra tap and needs no client JS, so there's no reason not
// to have it.
export default async function DeleteTransactionPage({
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
        ← Cancel
      </Link>
      <Card>
        <CardBody>
          <p className="mb-1 text-sm font-medium text-ink">Delete this transaction?</p>
          <p className="mb-4 text-sm text-ink-secondary">
            {tx.type} · {tx.occurred_on} · {rp(Number(tx.amount))}
            {tx.note ? ` · ${tx.note}` : ""}
          </p>
          <div className="flex items-center gap-2">
            <form action={deleteTransactionAction}>
              <input type="hidden" name="id" value={tx.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="danger">
                Delete
              </Button>
            </form>
            <ButtonLink href={returnTo} variant="secondary">
              Cancel
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
