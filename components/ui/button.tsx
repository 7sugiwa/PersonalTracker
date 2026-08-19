import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-ink text-page hover:opacity-90",
  secondary: "bg-surface-2 text-ink hover:bg-line",
  ghost: "text-ink-secondary hover:text-ink hover:bg-surface-2",
  danger: "text-negative hover:bg-negative-surface",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-2 text-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
}

/** Plain <button> — works unmodified inside a server
 * <form action={serverAction}>. Never a client wrapper. */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(BASE, VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  href,
  children,
}: ButtonOwnProps & { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx(BASE, VARIANT_CLASS[variant], SIZE_CLASS[size], className)}>
      {children}
    </Link>
  );
}
