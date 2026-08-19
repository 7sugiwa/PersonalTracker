// Fixed entity -> slot binding, never rank-based. An entity keeps its
// color even when sibling series are filtered out (e.g. an asset class
// with zero holdings disappearing from a breakdown). Shared between the
// data layer (getAllocationSeries needs it to pick stack order) and the
// chart components (which need it for color) — lives in lib/, not
// components/charts/, so the data layer doesn't reach into components/
// to import it.
export const SERIES_SLOT = {
  cash: 1,
  gold: 2,
  us_equity: 3,
  idx_equity: 4,
  crypto: 5,
  bond: 6,
  mutual_fund: 7,
} as const;

export type SeriesKey = keyof typeof SERIES_SLOT;

export function seriesVar(key: SeriesKey): string {
  return `var(--series-${SERIES_SLOT[key]})`;
}

export const CLASS_LABELS: Record<string, string> = {
  cash: "Cash",
  gold: "Gold",
  us_equity: "US Equity",
  idx_equity: "IDX Equity",
  crypto: "Crypto",
  bond: "Bond",
  mutual_fund: "Mutual Fund",
};
