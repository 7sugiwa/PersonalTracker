import { getSpendByCategory } from "@/lib/dashboard-data";
import { SpendByCategoryList } from "@/components/SpendByCategoryList";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";

export async function SpendCard() {
  const rows = await getSpendByCategory();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend by category (this month)</CardTitle>
      </CardHeader>
      <CardBody>
        <SpendByCategoryList rows={rows} />
      </CardBody>
    </Card>
  );
}
