'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useOpportunities } from '@/hooks/use-opportunities';
import { formatVolume } from '@/lib/indexer';
import {
  formatAnnualizedReturn,
  formatGrossReturn,
  formatDaysToExpiry,
  type OpportunityOptions,
} from '@/lib/opportunities';

type ProbFilter = 0.70 | 0.80 | 0.90;
type ExpiryFilter = 7 | 14 | 30 | 60;
type SortField = 'apr' | 'expiry' | 'probability' | 'volume';

const PROB_OPTIONS: { value: ProbFilter; label: string }[] = [
  { value: 0.70, label: '70%' },
  { value: 0.80, label: '80%' },
  { value: 0.90, label: '90%' },
];

const EXPIRY_OPTIONS: { value: ExpiryFilter; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'apr', label: 'APR' },
  { value: 'expiry', label: 'Expiry' },
  { value: 'probability', label: 'Probability' },
  { value: 'volume', label: 'Volume' },
];

export function OpportunitiesTable() {
  const [minProb, setMinProb] = useState<ProbFilter>(0.70);
  const [maxExpiry, setMaxExpiry] = useState<ExpiryFilter>(30);
  const [sortBy, setSortBy] = useState<SortField>('apr');

  const options: OpportunityOptions = useMemo(() => ({
    minProbability: minProb,
    maxDaysToExpiry: maxExpiry,
    sortBy,
  }), [minProb, maxExpiry, sortBy]);

  const { data: opportunities, isLoading, error } = useOpportunities(options);

  const stats = useMemo(() => {
    if (!opportunities || opportunities.length === 0) return null;
    const avgApr = opportunities.reduce((sum, o) => sum + o.annualizedReturn, 0) / opportunities.length;
    const nearestExpiry = Math.min(...opportunities.map((o) => o.daysToExpiry));
    const totalVolume = opportunities.reduce((sum, o) => sum + o.market.volume, 0);
    return { count: opportunities.length, avgApr, nearestExpiry, totalVolume };
  }, [opportunities]);

  return (
    <div className="space-y-5">
      {/* Filter controls */}
      <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
        <FilterGroup label="Min_Prob:" options={PROB_OPTIONS} value={minProb} onChange={setMinProb} />
        <FilterGroup label="Expires_In:" options={EXPIRY_OPTIONS} value={maxExpiry} onChange={setMaxExpiry} />
        <FilterGroup label="Sort_By:" options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Opportunities" value={stats.count.toString()} />
          <StatCard label="Avg APR" value={formatAnnualizedReturn(stats.avgApr)} accent />
          <StatCard label="Nearest Expiry" value={formatDaysToExpiry(stats.nearestExpiry)} />
          <StatCard label="Total Volume" value={formatVolume(stats.totalVolume)} />
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">Market</th>
                  <th className="text-center w-20">Side</th>
                  <th className="text-center w-20">Prob</th>
                  <th className="text-center w-20">Cost</th>
                  <th className="text-right w-16">Expiry</th>
                  <th className="text-right w-20">Return</th>
                  <th className="text-right w-24">APR</th>
                  <th className="text-right w-24 hidden md:table-cell">Volume</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td><div className="h-4 bg-[var(--card-border)] rounded w-3/4" /></td>
                    <td><div className="h-4 bg-[var(--card-border)] rounded w-10 mx-auto" /></td>
                    <td><div className="h-4 bg-[var(--card-border)] rounded w-12 mx-auto" /></td>
                    <td><div className="h-4 bg-[var(--card-border)] rounded w-12 mx-auto" /></td>
                    <td><div className="h-4 bg-[var(--card-border)] rounded w-8 ml-auto" /></td>
                    <td><div className="h-4 bg-[var(--card-border)] rounded w-14 ml-auto" /></td>
                    <td><div className="h-4 bg-[var(--card-border)] rounded w-14 ml-auto" /></td>
                    <td className="hidden md:table-cell"><div className="h-4 bg-[var(--card-border)] rounded w-14 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="glass-card p-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-[var(--danger-soft)] text-[var(--danger)] mb-3">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="font-mono text-sm text-[var(--danger)]">
            {error instanceof Error ? error.message : 'Failed to load opportunities'}
          </p>
        </div>
      )}

      {/* Data table */}
      {!isLoading && !error && opportunities && opportunities.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">Market</th>
                  <th className="text-center w-20">Side</th>
                  <th className="text-center w-20">Prob</th>
                  <th className="text-center w-20">Cost</th>
                  <th className="text-right w-16">Expiry</th>
                  <th className="text-right w-20">Return</th>
                  <th className="text-right w-24">APR</th>
                  <th className="text-right w-24 hidden md:table-cell">Volume</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp, index) => {
                  const probPct = (opp.price * 100).toFixed(1);
                  const costCents = `${(opp.price * 100).toFixed(1)}\u00A2`;
                  const expiryColor =
                    opp.daysToExpiry < 3
                      ? 'text-[var(--danger)]'
                      : opp.daysToExpiry < 7
                        ? 'text-[var(--warning)]'
                        : 'text-[var(--foreground-muted)]';

                  return (
                    <tr
                      key={opp.market.id}
                      className="market-row-item animate-fade-up group"
                      style={{ animationDelay: `${(index % 20) * 25}ms` }}
                    >
                      <td>
                        <Link
                          href={`/market/${opp.market.id}`}
                          className="block hover:text-[var(--accent)] transition-colors"
                        >
                          <span className="line-clamp-2 text-sm font-medium">
                            {opp.market.question}
                          </span>
                          {opp.market.event?.title && (
                            <span className="mt-0.5 block font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase tracking-wider line-clamp-1">
                              {opp.market.event.title}
                            </span>
                          )}
                          <div className="mt-2 price-bar">
                            <div
                              className="price-bar-fill bg-gradient-to-r from-[var(--success)] to-[var(--success)]/40"
                              style={{ width: `${opp.price * 100}%` }}
                            />
                          </div>
                        </Link>
                      </td>
                      <td className="text-center">
                        <span className={`font-mono text-xs font-bold ${opp.recommendedOutcome.toLowerCase() === 'no' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                          {opp.recommendedOutcome}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="font-mono text-sm font-bold text-[var(--success)]">
                          {probPct}%
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="font-mono text-sm text-[var(--foreground)]">
                          {costCents}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={`font-mono text-xs font-medium ${expiryColor}`}>
                          {formatDaysToExpiry(opp.daysToExpiry)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono text-xs text-[var(--success)]">
                          {formatGrossReturn(opp.grossReturn)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-mono text-sm font-bold text-[var(--accent)] text-glow-accent">
                          {formatAnnualizedReturn(opp.annualizedReturn)}
                        </span>
                      </td>
                      <td className="text-right hidden md:table-cell">
                        <span className="font-mono text-xs text-[var(--foreground-muted)]">
                          {formatVolume(opp.market.volume)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && opportunities && opportunities.length === 0 && (
        <div className="glass-card p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--card)] mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-[var(--foreground-muted)]" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p className="font-mono text-sm text-[var(--foreground-muted)] mb-2">
            No opportunities match current filters
          </p>
          <p className="font-mono text-[0.65rem] text-[var(--foreground-muted)] uppercase tracking-wider">
            Try lowering min probability or extending the expiry window
          </p>
        </div>
      )}
    </div>
  );
}

function FilterGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[0.65rem] text-[var(--foreground-muted)] uppercase tracking-wider mr-1">
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`btn ${value === opt.value ? 'btn-ghost active' : 'btn-ghost'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass-card p-3">
      <p className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`font-mono text-lg font-bold ${accent ? 'text-[var(--accent)] text-glow-accent' : 'text-[var(--foreground)]'}`}>
        {value}
      </p>
    </div>
  );
}
