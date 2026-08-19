"use client";

import { LineChart, Line, ResponsiveContainer, type DotItemDotProps } from "recharts";

/** Bare line, no axes/grid/tooltip — the only chart form that
 * legitimately skips the hover layer. Renders nothing below 3 points
 * (see lib/history.ts): 2 points is a straight segment that reads as
 * "no volatility", 1 is flat and reads as "no change". */
export function Sparkline({
  data,
  width = 96,
  height = 28,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (data.length < 3) return null;

  const points = data.map((v, i) => ({ i, v }));
  const lastIndex = points.length - 1;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke="var(--series-1)"
            strokeWidth={1.5}
            strokeOpacity={0.55}
            isAnimationActive={false}
            dot={(props: DotItemDotProps) => {
              const { cx, cy, index } = props;
              if (index !== lastIndex || cx == null || cy == null) {
                return <g />;
              }
              return <circle cx={cx} cy={cy} r={2.5} fill="var(--series-1)" />;
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
