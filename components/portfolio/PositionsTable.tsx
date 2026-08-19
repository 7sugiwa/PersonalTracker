import Link from "next/link";
import type { Position } from "@/lib/positions-data";
import { rp, rpSigned, pct, pctSigned, qty, longDate } from "@/lib/format";
import { CLASS_LABELS } from "@/components/charts/chart-theme";
import { Table, THead, TBody, TR, TH, TDNum } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export function PositionsTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <EmptyState
        title="No positions yet"
        hint="Buy an asset via the Telegram bot and it'll show up here."
        height={160}
      />
    );
  }

  return (
    <Table>
      <THead>
        <TH>Asset</TH>
        <TH>Class</TH>
        <TH className="text-right">Quantity</TH>
        <TH className="text-right">Avg cost</TH>
        <TH className="text-right">Price</TH>
        <TH className="text-right">Market value</TH>
        <TH className="text-right">Unrealized</TH>
        <TH className="text-right">Weight</TH>
      </THead>
      <TBody>
        {positions.map((p) => (
          <TR key={p.assetId}>
            <td className="py-2 pr-3">
              <Link
                href={`/transactions?asset=${p.assetId}`}
                className="font-medium text-ink transition-colors hover:text-ring"
              >
                {p.symbol}
              </Link>
              <p className="text-xs text-ink-muted">{p.displayName}</p>
            </td>
            <td className="py-2 pr-3">
              <Badge tone="neutral">{CLASS_LABELS[p.assetClass] ?? p.assetClass}</Badge>
            </td>
            <TDNum>{qty(p.quantity, p.unit)}</TDNum>
            <TDNum>{rp(p.avgCostIdr)}</TDNum>
            <TDNum>
              {p.priced ? (
                <>
                  {rp(p.latestPrice ?? 0)}
                  {p.stale && (
                    <span
                      className="ml-1 inline-block align-middle"
                      title={p.priceOn ? `Last priced ${longDate(p.priceOn)}` : "Never priced"}
                    >
                      <Badge tone="warning">stale</Badge>
                    </span>
                  )}
                </>
              ) : (
                <span title="No price available — excluded from market value" className="text-ink-muted">
                  —
                </span>
              )}
            </TDNum>
            <TDNum>
              {p.marketValueIdr !== null ? (
                rp(p.marketValueIdr)
              ) : (
                <span title="Not valued — no price or FX rate yet" className="text-ink-muted">
                  —
                </span>
              )}
            </TDNum>
            <TDNum>
              {p.unrealizedIdr !== null ? (
                <span className={p.unrealizedIdr >= 0 ? "text-positive" : "text-negative"}>
                  {rpSigned(p.unrealizedIdr)}
                  {p.returnPct !== null && ` (${pctSigned(p.returnPct)})`}
                </span>
              ) : (
                <span className="text-ink-muted">—</span>
              )}
            </TDNum>
            <TDNum>
              {p.weight !== null ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-series-1"
                      style={{ width: `${Math.min(100, p.weight * 100)}%` }}
                    />
                  </span>
                  {pct(p.weight)}
                </span>
              ) : (
                <span className="text-ink-muted">—</span>
              )}
            </TDNum>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
