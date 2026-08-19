// Shared degradation rule so every chart/delta tells the same honest
// story when net_worth_snapshots is thin (the app deployed 2026-08-18,
// so early on this is the common case, not an edge case).
export interface HistoryStatus {
  have: number;
  need: number;
  since: string | null;
  ok: boolean;
}

export function historyStatus(have: number, need: number, since: string | null): HistoryStatus {
  return { have, need, since, ok: have >= need };
}

// Minimum snapshot counts each surface needs to render honestly.
export const HISTORY_MIN = {
  line: 2,
  stackedArea: 2,
  sparkline: 3,
  delta1d: 2,
  delta7d: 7,
  delta30d: 30,
} as const;
