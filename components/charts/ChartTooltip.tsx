"use client";

// Deliberately not typed against recharts' TooltipContentProps<TValue,
// TName> generic — <Tooltip content={...}> infers those generics from
// context in a way that fights a shared, reusable tooltip component
// across differently-typed charts (line/area/bar all resolve slightly
// different ValueType/NameType defaults). This narrow shape is all the
// component actually reads, and covers every chart in this app.
interface Payload {
  color?: string;
  name?: React.ReactNode;
  value?: unknown;
}

export function ChartTooltip({
  active,
  payload,
  label,
  format,
  labelFormat,
}: {
  active?: boolean;
  payload?: readonly Payload[];
  label?: unknown;
  format: (v: number) => string;
  labelFormat?: (l: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      {label != null && (
        <p className="mb-1 text-ink-secondary">
          {labelFormat ? labelFormat(String(label)) : String(label)}
        </p>
      )}
      <dl className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-2.5 shrink-0"
              style={{ background: entry.color }}
              aria-hidden
            />
            <dt className="text-ink-secondary">{entry.name}</dt>
            <dd className="ml-auto font-mono font-semibold tabular-nums text-ink">
              {format(Number(entry.value))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
