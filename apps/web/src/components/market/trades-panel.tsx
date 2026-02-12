'use client';

import { Badge, Skeleton } from '@app/ui';
import { useOnChainTrades } from '@/hooks';

interface TradesPanelProps {
  tokenId: string | null;
}

function formatTimeAgo(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function truncateHash(hash: string): string {
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export function TradesPanel({ tokenId }: TradesPanelProps) {
  const { data: trades, isLoading, isError } = useOnChainTrades(tokenId, 50);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-1 flex items-center gap-3 text-[0.6rem] font-mono text-muted-foreground uppercase tracking-wider border-b border-border/50">
          <span className="w-10">Side</span>
          <span className="flex-1">Price</span>
          <span className="flex-1">Size</span>
          <span className="flex-1">Time</span>
          <span className="w-20">Tx</span>
        </div>
        <div className="flex-1 p-3">
          <TradesSkeleton />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Failed to load trades
      </div>
    );
  }

  if (!trades?.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        No recent trades
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-3 py-1 flex items-center gap-3 text-[0.6rem] font-mono text-muted-foreground uppercase tracking-wider border-b border-border/50">
        <span className="w-10">Side</span>
        <span className="flex-1">Price</span>
        <span className="flex-1">Size</span>
        <span className="flex-1">Time</span>
        <span className="w-20">Tx</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trades.map((trade) => (
          <div
            key={trade.id}
            className="flex items-center gap-3 px-3 py-1 text-xs font-mono hover:bg-[var(--card-hover)] transition-colors"
          >
            <Badge
              variant={trade.side === 'BUY' ? 'positive' : 'negative'}
              className="w-10 justify-center text-[0.6rem] px-1 py-0"
            >
              {trade.side}
            </Badge>
            <span className="flex-1">
              {(trade.price * 100).toFixed(1)}c
            </span>
            <span className="flex-1 text-muted-foreground">
              {trade.size.toFixed(0)}
            </span>
            <span className="flex-1 text-muted-foreground">
              {formatTimeAgo(trade.timestamp)}
            </span>
            <a
              href={`https://polygonscan.com/tx/${trade.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-20 text-[var(--accent)] hover:underline truncate"
            >
              {truncateHash(trade.txHash)}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradesSkeleton() {
  return (
    <div className="space-y-1.5">
      <span className="sr-only">Loading trades...</span>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1">
          <Skeleton className="h-4 w-10 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
