'use client';

import { Badge, Button } from '@app/ui';
import { formatVolume } from '@/lib/indexer';
import type { MarketStats } from '@/lib/clickhouse';

type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

interface CompactHeaderProps {
  question: string;
  image?: string | null;
  category?: string | null;
  volume?: number;
  endDateIso?: string | null;
  midpoint: number | null;
  priceChange24h?: number | null;
  marketStats?: MarketStats | null;
  chartInterval: TimeInterval;
  onIntervalChange: (interval: TimeInterval) => void;
}

export function CompactHeader({
  question,
  image,
  category,
  volume,
  endDateIso,
  midpoint,
  priceChange24h,
  marketStats,
  chartInterval,
  onIntervalChange,
}: CompactHeaderProps) {
  const priceDisplay = midpoint != null ? `${(midpoint * 100).toFixed(1)}c` : '--';

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/50 min-h-[48px]">
      {/* Image */}
      {image && (
        <img
          src={image}
          alt=""
          className="w-8 h-8 rounded object-cover flex-shrink-0"
        />
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold truncate">{question}</h1>
        <div className="flex items-center gap-2 text-[0.6rem] font-mono text-muted-foreground">
          {category && <Badge variant="outline" className="text-[0.55rem] px-1 py-0">{category}</Badge>}
          {volume != null && <span>{formatVolume(volume)} vol</span>}
          {marketStats?.uniqueTraders != null && (
            <span>{marketStats.uniqueTraders.toLocaleString()} traders</span>
          )}
          {endDateIso && (
            <span>Ends {new Date(endDateIso).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-lg font-bold font-mono">{priceDisplay}</span>
        {priceChange24h != null && (
          <span
            className={`text-xs font-mono ${
              priceChange24h >= 0 ? 'text-positive' : 'text-negative'
            }`}
          >
            {priceChange24h >= 0 ? '+' : ''}
            {priceChange24h.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Interval buttons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {(['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const).map((interval) => (
          <Button
            key={interval}
            variant={chartInterval === interval ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onIntervalChange(interval)}
            className="text-[0.6rem] px-1.5 h-6 min-h-0 min-w-[28px]"
          >
            {interval.toUpperCase()}
          </Button>
        ))}
      </div>
    </div>
  );
}
