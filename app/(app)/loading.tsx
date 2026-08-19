import { StatTileSkeleton, ChartCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** Renders inside AppShell (nav stays visible/interactive during
 * navigation) — that's the reason the shell lives in the group layout
 * rather than in each page. Fixed heights matching the real components
 * so this swap causes zero layout shift. */
export default function AppLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
      </div>
      <ChartCardSkeleton />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}
