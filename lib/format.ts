// No "server-only" — client chart components (components/charts/*) import
// this too. Single locale switch: flip MONEY_LOCALE and every formatter
// below follows. UI copy is English, so grouping is en-US (Rp12,345,678),
// not id-ID (Rp12.345.678) — mixing the two produces a decimal-separator
// collision once compact notation appears ("12,3 jt" vs "12.3M").
const MONEY_LOCALE = "en-US";

// IDR has no sub-unit in everyday use (no sen) — round to whole rupiah.
// Without maximumFractionDigits the DB's numeric(20,4) values (e.g.
// 128345327.0815) print with stray decimals that overflow a KPI tile.
const numberFmt = new Intl.NumberFormat(MONEY_LOCALE, { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat(MONEY_LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "12,345,678" */
export function idr(n: number): string {
  return numberFmt.format(n);
}

/** "Rp12,345,678" */
export function rp(n: number): string {
  return `Rp${numberFmt.format(n)}`;
}

/** "+Rp1,234" / "−Rp1,234" (real minus sign, not a hyphen) */
export function rpSigned(n: number): string {
  if (n === 0) return `Rp${numberFmt.format(0)}`;
  const sign = n > 0 ? "+" : "−";
  return `${sign}Rp${numberFmt.format(Math.abs(n))}`;
}

/** "Rp12.3M" — one Intl-driven implementation. The old code had two
 * hand-rolled versions (NetWorthChart / IncomeExpenseChart) that
 * disagreed on the billions threshold; this replaces both. */
export function rpCompact(n: number): string {
  return `Rp${compactFmt.format(n)}`;
}

/** 0.1234 -> "12.3%" */
export function pct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** 0.1234 -> "+12.3%", -0.05 -> "−5.0%" */
export function pctSigned(ratio: number, digits = 1): string {
  if (ratio === 0) return `${(0).toFixed(digits)}%`;
  const sign = ratio > 0 ? "+" : "−";
  return `${sign}${Math.abs(ratio * 100).toFixed(digits)}%`;
}

/** Quantity with up to 8dp, trailing zeros trimmed: "1.5 gram" */
export function qty(n: number, unit?: string): string {
  const s = n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return unit ? `${s} ${unit}` : s;
}

// Dates from Postgres are plain YYYY-MM-DD strings. `new Date(iso)` parses
// that as UTC midnight, which renders as the previous day for anyone west
// of Greenwich — never do that. String-slice instead; all dates here are
// already WIB calendar dates (lib/wib.ts).
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-08-18" -> "18 Aug" */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_SHORT[Number(m) - 1]}`;
}

/** "2026-08-18" -> "18 Aug 2026" */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_SHORT[Number(m) - 1]} ${y}`;
}

/** "2026-08" -> "Aug 2026" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_SHORT[Number(m) - 1]} ${y}`;
}

/** ("2026-08-01","2026-08-18") -> "1–18 Aug" (same month) or
 * "18 Aug–02 Sep" (different months) */
export function rangeLabel(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-");
  const [ty, tm, td] = to.split("-");
  if (fy === ty && fm === tm) {
    return `${Number(fd)}–${Number(td)} ${MONTH_SHORT[Number(tm) - 1]}`;
  }
  return `${shortDate(from)}–${shortDate(to)}`;
}

/** Recharts' Tooltip `formatter` prop types its value param as
 * `ValueType | undefined` (ValueType = number | string |
 * ReadonlyArray<number|string>) — every chart's dataKey here is always a
 * single number, so this just coerces whatever shape comes through. */
export function idrTooltipFormatter(value: unknown): string {
  const n = Array.isArray(value) ? Number(value[0]) : Number(value);
  return rp(Number.isFinite(n) ? n : 0);
}
