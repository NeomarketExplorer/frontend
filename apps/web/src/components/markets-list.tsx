'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { formatVolume, getMarkets, type IndexerMarket } from '@/lib/indexer';
import { buildOutcomeEntries, getMaxOutcomePrice, isBinaryYesNo, isNoOutcome, isYesOutcome } from '@/lib/outcomes';

type SortField = 'volume' | 'liquidity' | 'volume_24hr';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'volume', label: 'Volume' },
  { value: 'liquidity', label: 'Liquidity' },
  { value: 'volume_24hr', label: '24h Vol' },
];

async function fetchMarkets(
  offset: number,
  limit: number,
  sort: SortField
): Promise<{ data: IndexerMarket[]; hasMore: boolean }> {
  const result = await getMarkets({
    limit,
    offset,
    closed: false,
    sort,
    order: 'desc',
  });

  return {
    data: result.data,
    hasMore: result.pagination.hasMore,
  };
}

export function MarketsList({ initialSort = 'volume' }: { initialSort?: SortField }) {
  const [sort, setSort] = useState<SortField>(initialSort);
  const [items, setItems] = useState<IndexerMarket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const showBinaryLabels = items.length === 0 ? true : items.every((market) => isBinaryYesNo(market.outcomes));

  const loadMore = useCallback(
    async (currentSort: SortField, currentOffset: number, append: boolean) => {
      if (loadingRef.current) return;

      loadingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchMarkets(currentOffset, 20, currentSort);

        if (append) {
          setItems((prev) => [...prev, ...result.data]);
        } else {
          setItems(result.data);
        }

        setHasMore(result.hasMore);
        offsetRef.current = currentOffset + result.data.length;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
        loadingRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    offsetRef.current = 0;
    setItems([]);
    setHasMore(true);
    loadMore(sort, 0, false);
  }, [sort, loadMore]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loadingRef.current &&
          items.length > 0
        ) {
          loadMore(sort, offsetRef.current, true);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, sort, items.length, loadMore]);

  const handleSortChange = (newSort: SortField) => {
    if (newSort !== sort) {
      setSort(newSort);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-mono text-[0.65rem] text-[var(--foreground-muted)] uppercase tracking-wider mr-2">
          Sort_By:
        </span>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSortChange(option.value)}
            className={`btn ${sort === option.value ? 'btn-ghost active' : 'btn-ghost'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">Market</th>
                <th className="text-center w-24">{showBinaryLabels ? 'Yes' : 'Top'}</th>
                <th className="text-center w-24">{showBinaryLabels ? 'No' : 'Runner-up'}</th>
                <th className="text-right w-28">Volume</th>
                <th className="text-right w-28 hidden md:table-cell">Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((market, index) => {
                const outcomes = buildOutcomeEntries(market.outcomes, market.outcomePrices);
                const maxPrice = getMaxOutcomePrice(outcomes);
                const sorted = [...outcomes].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
                const primary = sorted[0];
                const secondary = sorted[1];
                const yesPrice = outcomes.find((outcome) => isYesOutcome(outcome.label))?.price ?? null;
                const noPrice = outcomes.find((outcome) => isNoOutcome(outcome.label))?.price ?? null;
                const yesPct = yesPrice != null ? yesPrice * 100 : 0;
                const topPct = maxPrice * 100;

                return (
                  <tr
                    key={market.id}
                    className="market-row-item animate-fade-up group"
                    style={{ animationDelay: `${(index % 20) * 25}ms` }}
                  >
                    <td>
                      <Link
                        href={`/market/${market.id}`}
                        className="block hover:text-[var(--accent)] transition-colors"
                      >
                        <span className="line-clamp-2 text-sm font-medium">
                          {market.question}
                        </span>
                        {!isBinaryYesNo(market.outcomes) && (
                          <span className="mt-1 inline-block font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase tracking-wider">
                            Multi-outcome
                          </span>
                        )}
                        <div className="mt-2 price-bar">
                          <div
                            className="price-bar-fill bg-gradient-to-r from-[var(--success)] to-[var(--success)]/40"
                            style={{ width: `${showBinaryLabels ? yesPct : topPct}%` }}
                          />
                        </div>
                      </Link>
                    </td>
                    <td className="text-center">
                      {showBinaryLabels ? (
                        <span className="font-mono text-sm font-bold text-[var(--success)] text-glow-success">
                          {yesPrice != null ? `${(yesPrice * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                      ) : primary ? (
                        <div className="flex flex-col items-center">
                          <span className="font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase">
                            {primary.label}
                          </span>
                          <span className="font-mono text-sm font-bold" style={{ color: primary.color }}>
                            {primary.price != null ? `${(primary.price * 100).toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-sm text-[var(--foreground-muted)]">N/A</span>
                      )}
                    </td>
                    <td className="text-center">
                      {showBinaryLabels ? (
                        <span className="font-mono text-sm font-bold text-[var(--danger)] text-glow-danger">
                          {noPrice != null ? `${(noPrice * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                      ) : secondary ? (
                        <div className="flex flex-col items-center">
                          <span className="font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase">
                            {secondary.label}
                          </span>
                          <span className="font-mono text-sm font-bold" style={{ color: secondary.color }}>
                            {secondary.price != null ? `${(secondary.price * 100).toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-sm text-[var(--foreground-muted)]">N/A</span>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="font-mono text-xs text-[var(--foreground-muted)]">
                        {formatVolume(market.volume)}
                      </span>
                    </td>
                    <td className="text-right hidden md:table-cell">
                      <span className="font-mono text-xs text-[var(--foreground-muted)]">
                        {formatVolume(market.liquidity)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={sentinelRef} className="h-4" />

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div className="glass-card p-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-[var(--danger-soft)] text-[var(--danger)] mb-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="font-mono text-sm text-[var(--danger)]">{error}</p>
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="text-center py-6">
          <p className="font-mono text-[0.7rem] text-[var(--foreground-muted)] uppercase tracking-widest">
            // End of data stream
          </p>
        </div>
      )}

      {!isLoading && items.length === 0 && !error && (
        <div className="glass-card p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--card)] mb-4">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-7 h-7 text-[var(--foreground-muted)]"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          </div>
          <p className="font-mono text-sm text-[var(--foreground-muted)]">No markets found</p>
        </div>
      )}
    </div>
  );
}
