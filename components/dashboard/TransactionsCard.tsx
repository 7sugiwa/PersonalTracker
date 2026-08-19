import { getRecentTransactions } from "@/lib/dashboard-data";
import { RecentTransactions } from "@/components/RecentTransactions";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";

export async function TransactionsCard() {
  const transactions = await getRecentTransactions(25);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
      </CardHeader>
      <CardBody>
        <RecentTransactions transactions={transactions} />
      </CardBody>
    </Card>
  );
}
