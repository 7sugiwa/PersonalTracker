import type { ReactNode } from "react";
import { cx } from "./cx";

/** Display-size figure. No tabular-nums here — at 28px+ proportional
 * figures look tighter and more considered; tabular-nums is reserved for
 * tables and inline deltas where columns must align. Use at most once
 * per view. */
export function HeroFigure({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("font-sans text-3xl font-semibold text-ink sm:text-4xl", className)}>
      {children}
    </p>
  );
}

export function StatTile({
  label,
  value,
  delta,
  sparkline,
  footnote,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  sparkline?: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-ink tabular-nums">{value}</p>
      {(delta || sparkline) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {delta}
          {sparkline}
        </div>
      )}
      {footnote && <p className="mt-1 text-xs text-ink-muted">{footnote}</p>}
    </div>
  );
}
