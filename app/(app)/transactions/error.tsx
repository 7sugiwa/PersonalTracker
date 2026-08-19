"use client";

import { Button, ButtonLink } from "@/components/ui/button";

export default function TransactionsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-medium text-ink">Couldn&apos;t load transactions.</p>
      {error.digest && <p className="font-mono text-xs text-ink-muted">{error.digest}</p>}
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
        <ButtonLink href="/" variant="ghost">
          Go home
        </ButtonLink>
      </div>
    </div>
  );
}
