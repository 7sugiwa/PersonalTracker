import { longDate } from "@/lib/format";

/** Distinct from EmptyState: "not enough history yet" is a different
 * message from "nothing here" — the data pipeline is working, it just
 * hasn't accumulated enough daily snapshots for this view. */
export function InsufficientHistory({
  have,
  need,
  since,
  height = 280,
}: {
  have: number;
  need: number;
  since: string | null;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 text-center"
      style={{ height }}
    >
      <p className="text-sm text-ink-secondary">Not enough history yet</p>
      <p className="text-xs text-ink-muted">
        {since ? `Tracking since ${longDate(since)} — ` : ""}
        {have} of {need} daily snapshots needed
      </p>
    </div>
  );
}
