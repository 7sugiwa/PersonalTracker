import { getIncomeVsExpenseSeries } from "@/lib/dashboard-data";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";

export async function IncomeExpenseCard() {
  const series = await getIncomeVsExpenseSeries(6);
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Income vs expense (last 6 months)</CardTitle>
      </CardHeader>
      <CardBody>
        <IncomeExpenseChart data={series} />
      </CardBody>
    </Card>
  );
}
