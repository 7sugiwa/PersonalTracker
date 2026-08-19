import { getNetWorthSeries } from "@/lib/dashboard-data";
import { historyStatus, HISTORY_MIN } from "@/lib/history";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { RangeChips } from "@/components/charts/RangeChips";
import { Card, CardHeader, CardTitle, CardAction, CardBody } from "@/components/ui/card";

export async function NetWorthChartCard({ nwDays }: { nwDays: number }) {
  const series = await getNetWorthSeries(nwDays);
  const history = historyStatus(series.length, HISTORY_MIN.line, series[0]?.date ?? null);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Net worth over time</CardTitle>
        <CardAction>
          <RangeChips active={nwDays} />
        </CardAction>
      </CardHeader>
      <CardBody>
        <NetWorthChart data={series} history={history} />
      </CardBody>
    </Card>
  );
}
