import { getNetWorthKpis, getMonthToDateSpend } from "@/lib/dashboard-data";
import { rp, rangeLabel } from "@/lib/format";
import { historyStatus, HISTORY_MIN } from "@/lib/history";
import { Card, CardBody } from "@/components/ui/card";
import { HeroFigure, StatTile } from "@/components/ui/stat-tile";
import { Delta, DeltaChip } from "@/components/ui/delta";
import { Sparkline } from "@/components/charts/Sparkline";

const WINDOW_LABEL = { "1d": "1D", "7d": "7D", "30d": "30D", ytd: "YTD" } as const;

/** One fetch each for getNetWorthKpis/getMonthToDateSpend, both
 * independent of the range-chip'd history chart below — kept in one
 * Suspense boundary because splitting further would just add round
 * trips without letting anything paint sooner. */
export async function KpiSection() {
  const [kpis, spend] = await Promise.all([getNetWorthKpis(), getMonthToDateSpend()]);

  const sparklineHistory = historyStatus(kpis.sparkline.length, HISTORY_MIN.sparkline, kpis.firstSnapshotOn);

  return (
    <div className="mb-6 space-y-4">
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Net worth</p>
            <HeroFigure className="mt-1">{rp(kpis.latest?.netWorth ?? 0)}</HeroFigure>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              {(Object.keys(WINDOW_LABEL) as Array<keyof typeof WINDOW_LABEL>).map((w) => (
                <div key={w} className="flex items-center gap-1.5">
                  <span className="text-xs text-ink-muted">{WINDOW_LABEL[w]}</span>
                  <DeltaChip value={kpis.deltas[w]} unavailable={!kpis.deltas[w]} />
                </div>
              ))}
            </div>
          </div>
          {sparklineHistory.ok && (
            <div className="shrink-0">
              <Sparkline data={kpis.sparkline} width={140} height={40} />
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Cash" value={rp(kpis.latest?.cash ?? 0)} />
        <StatTile label="Holdings" value={rp(kpis.latest?.holdings ?? 0)} />
        <StatTile
          label="Spend (MTD)"
          value={rp(spend.mtd)}
          delta={
            <Delta
              value={{ abs: spend.abs, pct: spend.pct }}
              invert
              label={`vs ${rangeLabel(spend.prevRange.from, spend.prevRange.to)}`}
            />
          }
        />
      </div>
    </div>
  );
}
