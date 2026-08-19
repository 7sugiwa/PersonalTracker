// Re-exported from lib/series.ts, which is where the data layer
// (getAllocationSeries) also needs the slot map — see that file for
// the rationale. This module additionally holds chart-only chrome
// constants that have no reason to live outside components/.
export { SERIES_SLOT, CLASS_LABELS, seriesVar, type SeriesKey } from "@/lib/series";

// Universal chart chrome shared across recharts components.
export const CHART_GRID = "var(--grid)";
export const CHART_AXIS = "var(--axis)";
export const CHART_TICK = { fill: "var(--text-muted)", fontSize: 11 };
