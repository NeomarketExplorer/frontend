'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Skeleton } from '@app/ui';
import { getDiscoverMarkets, type DiscoverMarket } from '@/lib/clickhouse';
import {
  buildOutcomeEntries,
  isBinaryYesNo,
  isYesOutcome,
  isNoOutcome,
} from '@/lib/outcomes';

type WindowOption = '1h' | '6h' | '24h' | '7d';

const WINDOW_OPTIONS: { value: WindowOption; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
];

export function HomeMarkets({ category }: { category?: string | null }) {
  const [window, setWindow] = useState<WindowOption>('1h');
  const [items, setItems] = useState<DiscoverMarket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);

    getDiscoverMarkets({ window, limit: 12, category: category ?? undefined })
      .then((data) => {
        if (!mounted) return;
        setItems(data);
        if (process.env.NODE_ENV !== 'production') {
          // Devtools sanity check: compare this response to what renders.
          console.debug(`[discover/markets] window=${window} category=${category ?? ''} limit=5`, data.slice(0, 5));
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setItems([]);
        setError(err instanceof Error ? err.message : 'Failed to load');
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[discover/markets] window=${window} category=${category ?? ''} failed`, err);
        }
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [window, category]);

  const showBinaryLabels =
    items.length === 0 ? true : items.every((market) => isBinaryYesNo(market.outcomes ?? []));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-mono text-[0.65rem] text-[var(--foreground-muted)] uppercase tracking-wider mr-2">
          Window:
        </span>
        {WINDOW_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setWindow(option.value)}
            className={`btn ${window === option.value ? 'btn-ghost active' : 'btn-ghost'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {isLoading && items.length === 0
          ? Array.from({ length: 6 }).map((_, i) => <MarketCardSkeleton key={i} />)
          : items.map((market, index) => (
              <div
                key={market.marketId}
                className="event-card-item animate-fade-up"
                style={{ animationDelay: `${(index % 12) * 40}ms` }}
              >
                <MarketCard market={market} showBinaryLabels={showBinaryLabels} />
              </div>
            ))}
      </div>

      {error && (
        <div className="glass-card p-6 text-center">
          <p className="font-mono text-sm text-[var(--danger)]">
            Discovery feed unavailable: {error}
          </p>
          <p className="font-mono text-[0.7rem] text-[var(--foreground-muted)] mt-2">
            Expected ClickHouse endpoint: <span className="text-[var(--foreground)]">GET /discover/markets</span>
          </p>
        </div>
      )}

      {!isLoading && items.length === 0 && !error && (
        <div className="glass-card p-10 text-center">
          <p className="font-mono text-sm text-[var(--foreground-muted)]">No markets found</p>
        </div>
      )}
    </div>
  );
}

function MarketCard({ market, showBinaryLabels }: { market: DiscoverMarket; showBinaryLabels: boolean }) {
  const outcomes = buildOutcomeEntries(market.outcomes ?? [], market.outcomePrices ?? []);
  const yes = outcomes.find((o) => isYesOutcome(o.label))?.price ?? null;
  const no = outcomes.find((o) => isNoOutcome(o.label))?.price ?? null;
  const top = [...outcomes].sort((a, b) => (b.price ?? -1) - (a.price ?? -1))[0] ?? null;

  return (
    <Link href={`/market/${market.marketId}`} className="group block glass-card overflow-hidden hover-lift h-full">
      <div className="p-3 sm:p-4">
        <h3 className="font-medium text-sm text-[var(--foreground)] line-clamp-3 group-hover:text-[var(--accent)] transition-colors">
          {market.question}
        </h3>

        <div className="mt-3 flex items-end justify-between gap-3">
          {showBinaryLabels ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase">Yes</span>
                <span className="font-mono text-sm font-bold text-[var(--success)]">
                  {yes != null ? `${(yes * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase">No</span>
                <span className="font-mono text-sm font-bold text-[var(--danger)]">
                  {no != null ? `${(no * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase">Top</span>
              <span className="font-mono text-sm font-bold" style={{ color: top?.color }}>
                {top?.price != null ? `${(top.price * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          )}

          <div className="text-right">
            <span className="font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase">Vol</span>
            <div className="font-mono text-xs text-[var(--foreground-muted)]">
              {market.volume != null ? `$${market.volume.toLocaleString()}` : '-'}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MarketCardSkeleton() {
  return (
    <div className="glass-card p-4">
      <Skeleton className="h-4 w-3/4 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-6" />
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-10 ml-auto" />
          <Skeleton className="h-4 w-14 ml-auto" />
        </div>
      </div>
    </div>
  );
}
