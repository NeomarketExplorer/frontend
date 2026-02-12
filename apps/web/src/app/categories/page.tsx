import Link from 'next/link';
import type { Metadata } from 'next';
import { getStats, formatVolume } from '@/lib/indexer';

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse prediction markets by category. Find markets in politics, crypto, sports, finance, and more.',
  openGraph: {
    title: 'Categories | Neomarket',
    description: 'Browse prediction markets by category.',
  },
};

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default async function CategoriesPage() {
  let categories: Array<{ name: string; count: number; volume: number }> = [];

  try {
    const stats = await getStats();
    categories = stats.data.categories ?? [];
  } catch {
    // Stats fetch failed — show empty state
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Categories</h1>
          <p className="font-mono text-xs text-[var(--foreground-muted)] mt-1">
            // Browse markets by category
          </p>
        </div>
        <span className="font-mono text-xs text-[var(--foreground-muted)]">
          {categories.length} categories
        </span>
      </div>

      {categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={`/categories/${toSlug(category.name)}`}
              className="group glass-card p-4 sm:p-5 hover-lift"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="font-semibold text-sm text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                  {category.name}
                </h2>
                <div className="w-6 h-6 rounded bg-[var(--card-solid)] flex items-center justify-center text-[var(--foreground-muted)] group-hover:bg-[var(--accent)] group-hover:text-[var(--background)] transition-all flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="2.5">
                    <line x1="7" y1="17" x2="17" y2="7" />
                    <polyline points="7 7 17 7 17 17" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono text-xs">
                <div>
                  <span className="text-[var(--foreground-muted)]">Events </span>
                  <span className="font-semibold text-[var(--foreground)]">{category.count}</span>
                </div>
                <div>
                  <span className="text-[var(--foreground-muted)]">Volume </span>
                  <span className="font-semibold text-[var(--accent)]">{formatVolume(category.volume)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-card p-10 text-center">
          <p className="font-mono text-sm text-[var(--foreground-muted)]">No categories available yet</p>
        </div>
      )}
    </div>
  );
}
