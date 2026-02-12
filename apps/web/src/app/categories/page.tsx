import Link from 'next/link';
import type { Metadata } from 'next';
import { getCategories, type IndexerCategory } from '@/lib/indexer';

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse prediction markets by category. Find markets in politics, crypto, sports, finance, and more.',
  openGraph: {
    title: 'Categories | Neomarket',
    description: 'Browse prediction markets by category.',
  },
};

export default async function CategoriesPage() {
  let categories: IndexerCategory[] = [];

  try {
    categories = await getCategories();
  } catch {
    // Fetch failed — show empty state
  }

  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

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
          {categories.length} categories &middot; {totalCount.toLocaleString()} events
        </span>
      </div>

      {categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
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

function CategoryCard({ category }: { category: IndexerCategory }) {
  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link
          href={`/categories/${category.slug}`}
          className="group flex items-start justify-between gap-3 flex-1"
        >
          <h2 className="font-semibold text-sm text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
            {category.label}
          </h2>
          <div className="w-6 h-6 rounded bg-[var(--card-solid)] flex items-center justify-center text-[var(--foreground-muted)] group-hover:bg-[var(--accent)] group-hover:text-[var(--background)] transition-all flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="2.5">
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </div>
        </Link>
      </div>

      <div className="font-mono text-xs mb-3">
        <span className="text-[var(--foreground-muted)]">Events </span>
        <span className="font-semibold text-[var(--foreground)]">{category.count.toLocaleString()}</span>
      </div>

      {category.children && category.children.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[var(--card-border)]">
          {category.children.map((child) => {
            const childLabel = child.label;
            return (
              <Link
                key={child.slug}
                href={`/categories/${child.slug}`}
                className="tag hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {childLabel}
                <span className="ml-1 text-[var(--foreground-muted)]">{child.count}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
