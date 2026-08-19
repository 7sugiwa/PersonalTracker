import { ButtonLink } from "@/components/ui/button";

export default function TransactionNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-medium text-ink">Transaction not found.</p>
      <p className="text-xs text-ink-muted">It may have been deleted already.</p>
      <ButtonLink href="/transactions" variant="secondary" className="mt-1">
        Back to transactions
      </ButtonLink>
    </div>
  );
}
