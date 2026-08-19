import { getAccountBalances } from "@/lib/dashboard-data";
import { AccountsTable } from "@/components/AccountsTable";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";

export async function AccountsCard() {
  const accounts = await getAccountBalances();
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
      </CardHeader>
      <CardBody>
        <AccountsTable accounts={accounts} />
      </CardBody>
    </Card>
  );
}
