const IDR = new Intl.NumberFormat("id-ID");

/** Recharts' Tooltip `formatter` prop types its value param as
 * `ValueType | undefined` (ValueType = number | string |
 * ReadonlyArray<number|string>) — every chart's dataKey here is always a
 * single number, so this just coerces whatever shape comes through. */
export function idrTooltipFormatter(value: unknown): string {
  const n = Array.isArray(value) ? Number(value[0]) : Number(value);
  return IDR.format(Number.isFinite(n) ? n : 0);
}
