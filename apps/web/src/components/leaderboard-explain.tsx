'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@app/ui';
import { useLeaderboardExplain } from '@/hooks';
import { formatVolume } from '@/lib/indexer';
import type { ExplainEvent } from '@/lib/clickhouse';

interface LeaderboardExplainDialogProps {
  user: string | null;
  period?: string;
  sort?: string;
  onClose: () => void;
}

export function LeaderboardExplainDialog({
  user,
  period,
  sort,
  onClose,
}: LeaderboardExplainDialogProps) {
  const metric = sort === 'volume' ? 'volume' : 'realized_pnl_usd_v1';
  const { data, isLoading, isError } = useLeaderboardExplain(user, {
    metric,
    period,
    limit: 10,
  });

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            PnL Breakdown
          </DialogTitle>
          {user && (
            <p className="font-mono text-xs text-[var(--foreground-muted)]">
              {user.slice(0, 6)}...{user.slice(-4)}
              {period && <span className="ml-2">({period})</span>}
            </p>
          )}
        </DialogHeader>

        {isLoading ? (
          <ExplainSkeleton />
        ) : isError ? (
          <div className="py-8 text-center">
            <p className="font-mono text-sm text-[var(--danger)]">
              Failed to load breakdown
            </p>
          </div>
        ) : !data || data.events.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-mono text-sm text-[var(--foreground-muted)]">
              No breakdown data available
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Realized PnL"
                value={data.summary.realizedPnlUsd}
                isCurrency
              />
              <StatCard
                label="Markets Traded"
                value={data.summary.marketsTraded}
              />
              <StatCard
                label="Total Events"
                value={data.summary.totalEvents}
              />
            </div>

            {/* Events table */}
            <div className="overflow-auto flex-1 min-h-0">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Condition</th>
                    <th className="text-left">Type</th>
                    <th className="text-right">Realized PnL</th>
                    <th className="text-right">USDC Delta</th>
                    <th className="text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((evt, i) => (
                    <ExplainRow key={`${evt.conditionId}-${evt.txHash}`} event={evt} />
                  ))}
                </tbody>
              </table>
            </div>

            {data.summary.totalEvents > data.summary.eventCountReturned && (
              <p className="font-mono text-[0.65rem] text-[var(--foreground-muted)] text-center">
                Showing {data.summary.eventCountReturned} of {data.summary.totalEvents} events
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExplainRow({ event: evt }: { event: ExplainEvent }) {
  const pnlPositive = evt.realizedPnlUsd >= 0;

  return (
    <tr className="market-row-item">
      <td>
        <span className="font-mono text-xs">
          {evt.conditionId.slice(0, 8)}...
        </span>
      </td>
      <td>
        <span className="font-mono text-xs capitalize">
          {evt.eventType}
        </span>
      </td>
      <td className="text-right">
        <span
          className={`font-mono text-xs font-bold ${
            pnlPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'
          }`}
        >
          {pnlPositive ? '+' : '-'}${Math.abs(evt.realizedPnlUsd).toFixed(2)}
        </span>
      </td>
      <td className="text-right">
        <span className="font-mono text-xs">
          {formatVolume(Math.abs(evt.usdcDeltaUsd))}
        </span>
      </td>
      <td className="text-right">
        <span className="font-mono text-[0.65rem] text-[var(--foreground-muted)]">
          {formatTimestamp(evt.blockTimestamp)}
        </span>
      </td>
    </tr>
  );
}

function StatCard({
  label,
  value,
  isCurrency,
}: {
  label: string;
  value: number;
  isCurrency?: boolean;
}) {
  const positive = value >= 0;
  return (
    <div className="glass-card p-3">
      <div className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`font-mono text-sm font-bold mt-1 ${
          isCurrency ? (positive ? 'text-[var(--success)]' : 'text-[var(--danger)]') : ''
        }`}
      >
        {isCurrency
          ? `${positive ? '+' : '-'}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : value.toLocaleString()}
      </div>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts.replace(' ', 'T') + 'Z');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return ts.slice(0, 10);
  }
}

function ExplainSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
