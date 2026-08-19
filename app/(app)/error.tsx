"use client";

import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-medium text-ink">Couldn&apos;t load this page.</p>
      {error.digest && (
        <p className="font-mono text-xs text-ink-muted" title="Match this against the server logs">
          {error.digest}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
        <ButtonLink href="/" variant="ghost">
          Go home
        </ButtonLink>
      </div>
      <Link href="/" className="sr-only">
        Home
      </Link>
    </div>
  );
}
