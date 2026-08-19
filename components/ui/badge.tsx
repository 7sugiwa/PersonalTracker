import type { ReactNode } from "react";
import { cx } from "./cx";

type Tone = "neutral" | "positive" | "negative" | "warning" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-secondary",
  positive: "bg-positive-surface text-positive",
  negative: "bg-negative-surface text-negative",
  warning: "bg-warning-surface text-warning",
  accent: "bg-ring/10 text-ring",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
