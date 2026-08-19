import { findStaleAssets } from "@/lib/networth";

/** A silently-dead price scraper that leaves net worth frozen is worse
 * than a visible error — see docs/plan.md. This is that visible error. */
export async function StalenessBanner() {
  const stale = await findStaleAssets(5);
  if (stale.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-warning bg-warning-surface px-4 py-3 text-sm text-warning">
      <strong>Stale prices:</strong>{" "}
      {stale
        .map(
          (a) =>
            `${a.displayName} (${a.symbol}) — ${a.latestSnapshotOn ? `last updated ${a.latestSnapshotOn}` : "never updated"}`,
        )
        .join(" · ")}
      . A price source may be broken — check the cron logs.
    </div>
  );
}
