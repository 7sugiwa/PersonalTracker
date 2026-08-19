import { getLatestNetWorth } from "@/lib/dashboard-data";
import { AllocationChart } from "@/components/charts/AllocationChart";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";

export async function AllocationCard() {
  const latest = await getLatestNetWorth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset allocation</CardTitle>
      </CardHeader>
      <CardBody>
        <AllocationChart breakdown={latest?.breakdown ?? {}} />
      </CardBody>
    </Card>
  );
}
