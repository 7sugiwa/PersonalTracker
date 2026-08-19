import { ChartCardSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <ChartCardSkeleton height={200} />
    </div>
  );
}
