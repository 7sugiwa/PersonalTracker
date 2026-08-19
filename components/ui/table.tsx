import type { ReactNode, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cx } from "./cx";

/** Horizontal-scroll wrapper with a right-edge fade so a wide table on
 * mobile signals there's more without a visible scrollbar. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className={cx("w-full min-w-full text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line text-left text-ink-secondary">{children}</tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cx("border-b border-line last:border-0 hover:bg-surface-2/60", className)}>
      {children}
    </tr>
  );
}

export function TH({ children, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cx("py-2 pr-3 font-medium first:pl-0", className)} {...rest}>
      {children}
    </th>
  );
}

export function TD({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx("py-2 pr-3 first:pl-0", className)} {...rest}>
      {children}
    </td>
  );
}

/** Right-aligned numeric cell — tabular figures so digits line up. */
export function TDNum({
  children,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx("py-2 pr-3 text-right font-mono tabular-nums last:pr-0", className)} {...rest}>
      {children}
    </td>
  );
}

export function TableWrap({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest}>{children}</div>;
}
