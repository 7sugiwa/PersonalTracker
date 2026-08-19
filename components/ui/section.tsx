import type { ReactNode } from "react";
import { cx } from "./cx";

export function PageHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-6 flex items-center justify-between gap-3", className)}>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {action}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("mb-3 text-sm font-medium text-ink-secondary", className)}>{children}</h2>;
}
