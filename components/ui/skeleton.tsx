import type { CSSProperties } from "react";
import { cx } from "./cx";

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cx("animate-pulse rounded-md bg-surface-2", className)} style={style} />;
}

export function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={cx("h-4 w-24", className)} />;
}

/** Fixed heights matching the real StatTile so a loading.tsx swap
 * causes zero layout shift. */
export function StatTileSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-32" />
      <Skeleton className="mt-3 h-4 w-24" />
    </div>
  );
}

export function ChartCardSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 w-full" style={{ height }} />
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
