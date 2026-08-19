import { pctSigned, rpSigned } from "@/lib/format";
import { cx } from "./cx";

export interface DeltaValue {
  abs: number;
  pct: number | null;
}

function toneFor(dir: "up" | "down" | "flat", invert: boolean) {
  if (dir === "flat") return "flat";
  const good = invert ? dir === "down" : dir === "up";
  return good ? "good" : "bad";
}

/** Direction is carried by the glyph AND the color, never color alone
 * (colorblind-safe). `unavailable` renders a muted em-dash with a title
 * explaining what's missing, instead of a fabricated 0% or NaN.
 * `invert`: for metrics where an increase is unwelcome (e.g. spend vs
 * last month) — the glyph still reflects the literal direction, only
 * the color mapping flips. */
export function Delta({
  value,
  label,
  invert,
  unavailable,
  unavailableReason,
  className,
}: {
  value?: DeltaValue;
  label?: string;
  invert?: boolean;
  unavailable?: boolean;
  unavailableReason?: string;
  className?: string;
}) {
  if (unavailable || !value) {
    return (
      <span
        className={cx("text-sm text-ink-muted", className)}
        title={unavailableReason ?? "Not enough history yet"}
      >
        — {label && <span className="text-ink-muted">{label}</span>}
      </span>
    );
  }

  const dir = value.abs > 0 ? "up" : value.abs < 0 ? "down" : "flat";
  const tone = toneFor(dir, Boolean(invert));
  const colorClass =
    tone === "good" ? "text-positive" : tone === "bad" ? "text-negative" : "text-ink-muted";
  const glyph = dir === "up" ? "▲" : dir === "down" ? "▼" : "•";

  return (
    <span className={cx("inline-flex items-center gap-1 text-sm font-medium", colorClass, className)}>
      <span aria-hidden>{glyph}</span>
      <span className="font-mono tabular-nums">
        {rpSigned(value.abs)}
        {value.pct !== null && ` (${pctSigned(value.pct)})`}
      </span>
      {label && <span className="font-normal text-ink-muted">{label}</span>}
    </span>
  );
}

/** Compact pill form for inline use (e.g. table cells, KPI tiles). */
export function DeltaChip({
  value,
  invert,
  unavailable,
}: {
  value?: DeltaValue;
  invert?: boolean;
  unavailable?: boolean;
}) {
  if (unavailable || !value) {
    return <span className="text-xs text-ink-muted">—</span>;
  }
  const dir = value.abs > 0 ? "up" : value.abs < 0 ? "down" : "flat";
  const tone = toneFor(dir, Boolean(invert));
  const colorClass =
    tone === "good"
      ? "bg-positive-surface text-positive"
      : tone === "bad"
        ? "bg-negative-surface text-negative"
        : "bg-surface-2 text-ink-muted";
  const glyph = dir === "up" ? "▲" : dir === "down" ? "▼" : "•";
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", colorClass)}>
      <span aria-hidden>{glyph}</span>
      {value.pct !== null ? pctSigned(value.pct) : rpSigned(value.abs)}
    </span>
  );
}
