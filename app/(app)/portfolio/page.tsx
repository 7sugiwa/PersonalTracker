import { getPositions } from "@/lib/positions-data";
import { rp, rpSigned, pctSigned } from "@/lib/format";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { AllocationBar } from "@/components/portfolio/AllocationBar";
import { PageHeader } from "@/components/ui/section";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";

export default async function PortfolioPage() {
  const { positions, totals, unpricedCount, reconcilesWithNetWorth } = await getPositions();

  return (
    <div>
      <PageHeader title="Portfolio" />

      {!reconcilesWithNetWorth && (
        <div className="mb-6 rounded-xl border border-warning bg-warning-surface px-4 py-3 text-sm text-warning">
          <strong>
            {unpricedCount} position{unpricedCount === 1 ? "" : "s"} {unpricedCount === 1 ? "has" : "have"} no
            price yet
          </strong>{" "}
          and {unpricedCount === 1 ? "is" : "are"} excluded from market value below. Net worth on the
          Overview page currently counts {unpricedCount === 1 ? "it" : "them"} as Rp0.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Market value" value={rp(totals.marketValue)} />
        <StatTile label="Cost basis" value={rp(totals.costBasis)} />
        <StatTile
          label="Unrealized P&L"
          value={
            <span className={totals.unrealized >= 0 ? "text-positive" : "text-negative"}>
              {rpSigned(totals.unrealized)}
              {totals.returnPct !== null && ` (${pctSigned(totals.returnPct)})`}
            </span>
          }
        />
      </div>

      {positions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
          </CardHeader>
          <CardBody>
            <AllocationBar positions={positions} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardBody>
          <PositionsTable positions={positions} />
        </CardBody>
      </Card>
    </div>
  );
}
