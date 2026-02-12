import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getCategories, getEvents, formatVolume, type IndexerEvent, type IndexerCategory } from '@/lib/indexer';

function findCategory(
  categories: IndexerCategory[],
  slugParts: string[],
): IndexerCategory | null {
  const fullSlug = slugParts.join('/');

  // Check top-level
  for (const parent of categories) {
    if (parent.slug === fullSlug) return parent;
    // Check children
    if (parent.children) {
      for (const child of parent.children) {
        if (child.slug === fullSlug) return child;
      }
    }
  }
  return null;
}

function findParentCategory(
  categories: IndexerCategory[],
  parentSlug: string,
): IndexerCategory | null {
  return categories.find((c) => c.slug === parentSlug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categorySlug = slug.join('/');

  let label = slug[slug.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  try {
    const categories = await getCategories();
    const cat = findCategory(categories, slug);
    if (cat) label = cat.label;
  } catch {
    // Use fallback label
  }

  return {
    title: `${label} Markets`,
    description: `Browse prediction markets in the ${label} category. Trade on real-time odds and outcomes.`,
    openGraph: {
      title: `${label} Markets | Neomarket`,
      description: `Browse prediction markets in the ${label} category.`,
      url: `https://neomarket.bet/categories/${categorySlug}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const categorySlug = slug.join('/');
  const isChild = slug.length > 1;
  const parentSlug = slug[0];

  let categories: IndexerCategory[] = [];
  try {
    categories = await getCategories();
  } catch {
    // Failed to load categories
  }

  const category = findCategory(categories, slug);
  const parentCategory = isChild ? findParentCategory(categories, parentSlug) : null;
  const label = category?.label ?? slug[slug.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const count = category?.count ?? 0;

  // For parent categories, get child pills for sub-navigation
  const children = !isChild ? (category?.children ?? []) : [];

  // Fetch events for this category
  let events: IndexerEvent[] = [];
  let totalEvents = 0;
  try {
    const result = await getEvents({
      category: categorySlug,
      active: true,
      closed: false,
      limit: 50,
      sort: 'volume',
      order: 'desc',
    });
    events = result.data;
    totalEvents = result.pagination.total;
  } catch {
    // Events fetch failed
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/categories"
          className="font-mono text-xs text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
        >
          Categories
        </Link>
        <span className="font-mono text-xs text-[var(--foreground-muted)]">/</span>
        {isChild && parentCategory ? (
          <>
            <Link
              href={`/categories/${parentSlug}`}
              className="font-mono text-xs text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
            >
              {parentCategory.label}
            </Link>
            <span className="font-mono text-xs text-[var(--foreground-muted)]">/</span>
          </>
        ) : null}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{label}</h1>
        <div className="flex items-center gap-4 font-mono text-xs">
          {count > 0 && (
            <div>
              <span className="text-[var(--foreground-muted)]">Events </span>
              <span className="font-semibold text-[var(--foreground)]">{count.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Child category pills (only for parent categories) */}
      {children.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Link
            href={`/categories/${parentSlug}`}
            className="tag bg-[var(--accent)] text-[var(--background)] shrink-0"
          >
            All
          </Link>
          {children.map((child) => (
            <Link
              key={child.slug}
              href={`/categories/${child.slug}`}
              className="tag hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shrink-0"
            >
              {child.label}
              <span className="ml-1.5 text-[var(--foreground-muted)]">{child.count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Events grid */}
      {events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
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
            No events found in this category
          </p>
          <Link
            href="/categories"
            className="font-mono text-xs text-[var(--accent)] hover:underline"
          >
            Browse all categories
          </Link>
        </div>
      )}

      {totalEvents > events.length && (
        <div className="text-center">
          <p className="font-mono text-xs text-[var(--foreground-muted)]">
            Showing {events.length} of {totalEvents.toLocaleString()} events
          </p>
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: IndexerEvent }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group block glass-card overflow-hidden hover-lift h-full"
    >
      {event.image && (
        <div className="relative aspect-[2/1] bg-[var(--card-solid)] overflow-hidden">
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}
      <div className="p-3 sm:p-4">
        <h3 className="font-medium text-sm text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors mb-3">
          {event.title}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-[var(--foreground-muted)]">{formatVolume(event.volume)} vol</span>
            {event.volume24hr > 0 && (
              <span className="text-[var(--foreground-muted)]">{formatVolume(event.volume24hr)} 24h</span>
            )}
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
