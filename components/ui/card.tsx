import type { ReactNode } from "react";
import { cx } from "./cx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border border-line bg-surface", className)}>{children}</div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-center justify-between gap-3 px-4 pt-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("text-sm font-medium text-ink-secondary", className)}>{children}</h2>;
}

/** Right-slot in a CardHeader: range chips, "View all" links, etc. */
export function CardAction({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex items-center gap-2", className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("p-4", className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("border-t border-line px-4 py-3 text-sm text-ink-secondary", className)}>
      {children}
    </div>
  );
}
