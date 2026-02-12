'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStats, formatVolume, type IndexerStats } from '@/lib/indexer';
import { HomeEvents } from '@/components/home-events';

export const dynamic = 'force-dynamic';

type StatsData = IndexerStats['data'];

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function HomePage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await getStats();
        if (mounted) {
          setStats(result.data);
        }
      } catch (error) {
        console.error('Failed to load stats', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero */}
      <section className="relative">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            <span className="text-[var(--foreground)]">Prediction</span>
            <span className="text-[var(--accent)]">_Markets</span>
          </h1>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--accent-soft)] border border-[var(--accent)]/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent)]"></span>
            </span>
            <span className="font-mono text-[0.55rem] font-semibold text-[var(--accent)] uppercase tracking-wider">
              Live
            </span>
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 bg-[var(--card)] border border-[var(--card-border)]">
                <div className="h-3 w-16 bg-[var(--card-solid)] animate-pulse rounded mb-2" />
                <div className="h-5 w-20 bg-[var(--card-solid)] animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatCard label="Live_Events" value={(stats?.events.live ?? 0).toLocaleString()} accent="green" pulse />
            <StatCard label="Live_Markets" value={(stats?.markets.live ?? 0).toLocaleString()} accent="green" pulse />
            <StatCard label="Volume_24h" value={formatVolume(stats?.volume.last24hr ?? 0)} accent="cyan" />
            <StatCard label="Liquidity" value={formatVolume(stats?.liquidity ?? 0)} accent="cyan" />
          </div>
        )}
      </section>

      {/* Top Categories */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-gradient-to-b from-[var(--accent)] to-[var(--danger)] rounded-full" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Top Categories</h2>
          </div>
          <div className="font-mono text-xs text-[var(--foreground-muted)]">
            // Live market tags
          </div>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-24 bg-[var(--card-solid)] animate-pulse rounded shrink-0" />
            ))}
          </div>
        ) : stats?.categories?.length ? (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`tag cursor-pointer transition-colors shrink-0 ${
                selectedCategory === null ? 'bg-[var(--accent)] text-[var(--background)]' : 'hover:border-[var(--accent)]'
              }`}
            >
              All
            </button>
            {stats.categories.map((category) => (
              <Link
                key={category.name}
                href={`/categories/${toSlug(category.name)}`}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedCategory(
                    selectedCategory === category.name ? null : category.name
                  );
                }}
                onContextMenu={undefined}
                className={`tag cursor-pointer transition-colors shrink-0 ${
                  selectedCategory === category.name
                    ? 'bg-[var(--accent)] text-[var(--background)]'
                    : 'hover:border-[var(--accent)]'
                }`}
              >
                {category.name}
                <span className={`ml-2 ${selectedCategory === category.name ? 'opacity-70' : 'text-[var(--secondary)]'}`}>
                  {formatVolume(category.volume)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <p className="font-mono text-xs text-[var(--foreground-muted)]">No categories available yet</p>
          </div>
        )}
      </section>

      {/* Trending Events */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-gradient-to-b from-[var(--accent)] to-[var(--success)] rounded-full" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Trending Events</h2>
          </div>
          <a
            href="/events"
            className="font-mono text-xs text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
          >
            View All -&gt;
          </a>
        </div>

        <HomeEvents category={selectedCategory} />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  pulse = false,
}: {
  label: string;
  value: string;
  accent?: 'cyan' | 'green' | 'pink';
  pulse?: boolean;
}) {
  const accentColors = {
    cyan: { border: 'border-[var(--accent)]/20', text: 'text-[var(--accent)]' },
    green: { border: 'border-[var(--success)]/20', text: 'text-[var(--success)]' },
    pink: { border: 'border-[var(--danger)]/20', text: 'text-[var(--danger)]' },
  };

  const colors = accentColors[accent ?? 'cyan'];

  return (
    <div className={`group relative p-3 bg-[var(--card)] border ${colors.border} transition-all duration-300`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider">
          {label}
        </span>
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--success)]"></span>
          </span>
        )}
      </div>
      <p className={`font-mono font-bold text-base sm:text-lg ${colors.text}`}>{value}</p>
    </div>
  );
}
