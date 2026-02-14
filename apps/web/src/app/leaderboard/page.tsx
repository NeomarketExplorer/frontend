'use client';

import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@app/ui';
import { useLeaderboardFiltered } from '@/hooks';
import { formatVolume } from '@/lib/indexer';
import type { LeaderboardTrader } from '@/lib/clickhouse';
import { getCategories, type IndexerCategory } from '@/lib/indexer';
import { EventSearch } from '@/components/event-search';

type SortOption = 'pnl' | 'volume' | 'trades';
type PeriodOption = '24h' | '7d' | '30d' | 'all';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'pnl', label: 'P&L' },
  { value: 'volume', label: 'Volume' },
  { value: 'trades', label: 'Trades' },
];

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All' },
];

export default function LeaderboardPage() {
  const [sort, setSort] = useState<SortOption>('pnl');
  const [period, setPeriod] = useState<PeriodOption>('7d');
  const [category, setCategory] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventLabel, setEventLabel] = useState<string | null>(null);
  const [categories, setCategories] = useState<IndexerCategory[]>([]);

  useEffect(() => {
    let mounted = true;
    getCategories()
      .then((cats) => {
        if (!mounted) return;
        setCategories([...cats].sort((a, b) => b.count - a.count));
      })
      .catch(() => {
        if (!mounted) return;
        setCategories([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedCategoryLabel = useMemo(() => {
    if (!category) return 'All categories';
    return categories.find((c) => c.slug === category)?.label ?? category;
  }, [category, categories]);

  const { data, isLoading } = useLeaderboardFiltered({
    sort,
    period,
    category,
    eventId,
    limit: 50,
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && data) {
      // Devtools sanity check: confirm backend returns non-empty for filtered queries.
      console.debug(
        `[leaderboard] sort=${sort} period=${period} category=${category ?? ''} eventId=${eventId ?? ''} traders=${data.traders?.length ?? 0}`
      );
    }
  }, [data, sort, period, category, eventId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Leaderboard</h1>
          <p className="font-mono text-xs text-[var(--foreground-muted)] mt-1">
            Realized-only. Based on on-chain settlements and redemptions.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[var(--card)]">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSort(option.value)}
                className={`font-mono text-xs px-3 py-1.5 transition-colors ${
                  sort === option.value
                    ? 'bg-[var(--accent)] text-[var(--background)] font-bold'
                    : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Period pills */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[var(--card)]">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`font-mono text-xs px-3 py-1.5 transition-colors ${
                  period === option.value
                    ? 'bg-[var(--accent)] text-[var(--background)] font-bold'
                    : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <label className="sr-only" htmlFor="leaderboard-category">Category</label>
          <select
            id="leaderboard-category"
            value={category ?? ''}
            onChange={(e) => setCategory(e.target.value ? e.target.value : null)}
            className="bg-[var(--card)] border border-[var(--card-border)] font-mono text-xs px-2 py-2 h-[34px]"
            title={selectedCategoryLabel}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Event filter */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-[260px]">
            <EventSearch
              placeholder="Filter by event..."
              className="w-full"
              showOnlyLive={false}
              navigateOnSelect={false}
              onSelect={(evt) => {
                setEventId(evt.id);
                setEventLabel(evt.title);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            {eventId ? (
              <div className="font-mono text-xs text-[var(--foreground-muted)]">
                Event: <span className="text-[var(--foreground)]">{eventLabel ?? eventId}</span>
              </div>
            ) : (
              <div className="font-mono text-xs text-[var(--foreground-muted)]">Event: All</div>
            )}
            {eventId && (
              <button
                onClick={() => {
                  setEventId(null);
                  setEventLabel(null);
                }}
                className="btn btn-ghost"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LeaderboardSkeleton />
      ) : !data || data.traders.length === 0 ? (
        <LeaderboardEmpty />
      ) : (
        <LeaderboardTable traders={data.traders} />
      )}
    </div>
  );
}

function LeaderboardTable({ traders }: { traders: LeaderboardTrader[] }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left w-16">Rank</th>
              <th className="text-left">Address</th>
              <th className="text-right w-28">P&L</th>
              <th className="text-right w-24">Volume</th>
              <th className="text-right w-20">Trades</th>
              <th className="text-right w-20">Markets</th>
              <th className="text-right w-24">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {traders.map((trader, i) => (
              <LeaderboardRow key={trader.user} trader={trader} index={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaderboardRow({ trader, index }: { trader: LeaderboardTrader; index: number }) {
  const isTopThree = trader.rank <= 3;
  const pnlPositive = trader.totalPnl >= 0;

  return (
    <tr
      className="market-row-item animate-fade-up"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <td>
        <span
          className={`font-mono text-sm font-bold ${
            isTopThree ? 'text-[var(--accent)]' : ''
          }`}
        >
          #{trader.rank}
        </span>
      </td>
      <td>
        <span className="font-mono text-sm">
          {trader.user.slice(0, 6)}...{trader.user.slice(-4)}
        </span>
      </td>
      <td className="text-right">
        <span
          className={`font-mono text-sm font-bold ${
            pnlPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'
          }`}
        >
          {pnlPositive ? '+' : '-'}${Math.abs(trader.totalPnl).toFixed(2)}
        </span>
      </td>
      <td className="text-right">
        <span className="font-mono text-sm">
          {formatVolume(trader.totalVolume)}
        </span>
      </td>
      <td className="text-right">
        <span className="font-mono text-sm">
          {trader.totalTrades.toLocaleString()}
        </span>
      </td>
      <td className="text-right">
        <span className="font-mono text-sm text-[var(--foreground-muted)]">
          {trader.marketsTraded}
        </span>
      </td>
      <td className="text-right">
        <span className="font-mono text-sm text-[var(--foreground-muted)]">
          {trader.winRate != null ? `${(trader.winRate * 100).toFixed(1)}%` : '-'}
        </span>
      </td>
    </tr>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="glass-card overflow-hidden">
      <span className="sr-only">Loading leaderboard...</span>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left w-16"><Skeleton className="h-3 w-8" /></th>
              <th className="text-left"><Skeleton className="h-3 w-20" /></th>
              <th className="text-right w-28"><Skeleton className="h-3 w-14 ml-auto" /></th>
              <th className="text-right w-24"><Skeleton className="h-3 w-14 ml-auto" /></th>
              <th className="text-right w-20"><Skeleton className="h-3 w-10 ml-auto" /></th>
              <th className="text-right w-20"><Skeleton className="h-3 w-10 ml-auto" /></th>
              <th className="text-right w-24"><Skeleton className="h-3 w-12 ml-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <tr key={i}>
                <td><Skeleton className="h-4 w-8" /></td>
                <td><Skeleton className="h-4 w-28" /></td>
                <td className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                <td className="text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                <td className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></td>
                <td className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></td>
                <td className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaderboardEmpty() {
  return (
    <div className="glass-card p-10 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--card)] mb-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-7 h-7 text-[var(--foreground-muted)]"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 21h8m-4-4v4m-4.65-4h9.3a2 2 0 0 0 1.94-2.49L16.5 3H7.5L5.71 14.51A2 2 0 0 0 7.65 17Z" />
        </svg>
      </div>
      <p className="font-mono text-sm text-[var(--foreground-muted)]">
        No leaderboard data available
      </p>
    </div>
  );
}
