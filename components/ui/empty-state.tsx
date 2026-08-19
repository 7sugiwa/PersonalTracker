import type { ReactNode } from "react";

/** Moved out of components/charts/NetWorthChart.tsx, which used to
 * export this for the other three charts to import — an odd coupling
 * for a piece of UI chrome that has nothing chart-specific about it. */
export function EmptyState({
  title,
  hint,
  action,
  height = 280,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 text-center"
      style={{ height }}
    >
      <p className="text-sm text-ink-secondary">{title}</p>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      {action}
    </div>
  );
}
