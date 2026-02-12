import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getStats, getMarkets, formatVolume, type IndexerMarket } from '@/lib/indexer';

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function fromSlug(slug: string, categories: Array<{ name: string }>): string | null {
  const match = categories.find((c) => toSlug(c.name) === slug);
  return match?.name ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const displayName = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${displayName} Markets`,
    description: `Browse prediction markets in the ${displayName} category. Trade on real-time odds and outcomes.`,
    openGraph: {
      title: `${displayName} Markets | Neomarket`,
      description: `Browse prediction markets in the ${displayName} category.`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Resolve slug to category name via stats
  let categoryName: string | null = null;
  let categoryInfo: { name: string; count: number; volume: number } | null = null;

  try {
    const stats = await getStats();
    categoryName = fromSlug(slug, stats.data.categories ?? []);
    if (categoryName) {
      categoryInfo = stats.data.categories.find((c) => c.name === categoryName) ?? null;
    }
  } catch {
    // Stats failed
  }

  // If no category matched, show the slug as display name
  const displayName = categoryName ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Fetch markets for this category
  let markets: IndexerMarket[] = [];
  try {
    const result = await getMarkets({
      category: categoryName ?? displayName,
      limit: 50,
      sort: 'volume',
      order: 'desc',
    });
    markets = result.data;
  } catch {
    // Markets fetch failed
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/categories"
            className="font-mono text-xs text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
          >
            Categories
          </Link>
          <span className="font-mono text-xs text-[var(--foreground-muted)]">/</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{displayName}</h1>
          {categoryInfo && (
            <div className="flex items-center gap-4 font-mono text-xs">
              <div>
                <span className="text-[var(--foreground-muted)]">Events </span>
                <span className="font-semibold text-[var(--foreground)]">{categoryInfo.count}</span>
              </div>
              <div>
                <span className="text-[var(--foreground-muted)]">Volume </span>
                <span className="font-semibold text-[var(--accent)]">{formatVolume(categoryInfo.volume)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Markets grid */}
      {markets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      ) : (
        <div className="glass-card p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--card)] mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-[var(--foreground-muted)]" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="font-mono text-sm text-[var(--foreground-muted)] mb-2">
            No markets found in this category
          </p>
          <p className="font-mono text-xs text-[var(--foreground-muted)]">
            Category filtering will improve as the indexer adds support.
          </p>
        </div>
      )}
    </div>
  );
}

function MarketCard({ market }: { market: IndexerMarket }) {
  const yesPrice = market.outcomePrices?.[0];

  return (
    <Link
      href={`/market/${market.id}`}
      className="group block glass-card overflow-hidden hover-lift h-full"
    >
      {market.image && (
        <div className="relative aspect-[2/1] bg-[var(--card-solid)] overflow-hidden">
          <Image
            src={market.image}
            alt={market.question}
            fill
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}
      <div className="p-3 sm:p-4">
        <h3 className="font-medium text-sm text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors mb-3">
          {market.question}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 font-mono text-xs">
            {yesPrice != null && (
              <span className="font-semibold text-[var(--accent)]">
                {(yesPrice * 100).toFixed(0)}&cent; YES
              </span>
            )}
            <span className="text-[var(--foreground-muted)]">{formatVolume(market.volume)} vol</span>
          </div>
          <div className="w-6 h-6 rounded bg-[var(--card-solid)] flex items-center justify-center text-[var(--foreground-muted)] group-hover:bg-[var(--accent)] group-hover:text-[var(--background)] transition-all">
            <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="2.5">
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
