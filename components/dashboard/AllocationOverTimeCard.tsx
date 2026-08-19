import { getAllocationSeries } from "@/lib/dashboard-data";
import { historyStatus, HISTORY_MIN } from "@/lib/history";
import { AllocationOverTimeChart } from "@/components/charts/AllocationOverTimeChart";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";

export async function AllocationOverTimeCard() {
  const series = await getAllocationSeries(90);
  const history = historyStatus(series.points.length, HISTORY_MIN.stackedArea, series.firstSnapshotOn);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Allocation over time</CardTitle>
      </CardHeader>
      <CardBody>
        <AllocationOverTimeChart series={series} history={history} />
      </CardBody>
    </Card>
  );
}
