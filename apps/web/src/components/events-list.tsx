'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatVolume, getEvents, type IndexerEvent } from '@/lib/indexer';

export type EventFilter = 'open' | 'closed' | 'all';

const FILTER_OPTIONS: { value: EventFilter; label: string }[] = [
  { value: 'open', label: 'Active' },
  { value: 'closed', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

async function fetchEvents(
  offset: number,
  limit: number,
  filter: EventFilter,
  searchQuery?: string
): Promise<{ data: IndexerEvent[]; hasMore: boolean }> {
  const result = await getEvents({
    limit,
    offset,
    closed: filter === 'closed' ? true : filter === 'open' ? false : undefined,
    sort: 'volume',
    order: 'desc',
    search: searchQuery && searchQuery.trim().length > 0 ? searchQuery.trim() : undefined,
  });

  return {
    data: result.data,
    hasMore: result.pagination.hasMore,
  };
}

export function EventsList({
  initialFilter = 'open',
  searchQuery,
}: {
  initialFilter?: EventFilter;
  searchQuery?: string;
}) {
  const [filter, setFilter] = useState<EventFilter>(initialFilter);
  const [items, setItems] = useState<IndexerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(
    async (currentFilter: EventFilter, currentOffset: number, append: boolean, currentSearch?: string) => {
      if (loadingRef.current) return;

      loadingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchEvents(currentOffset, 12, currentFilter, currentSearch);

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
    loadMore(filter, 0, false, searchQuery);
  }, [filter, searchQuery, loadMore]);

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
          loadMore(filter, offsetRef.current, true, searchQuery);
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
  }, [hasMore, filter, items.length, searchQuery, loadMore]);

  const handleFilterChange = (newFilter: EventFilter) => {
    if (newFilter !== filter) {
      setFilter(newFilter);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-mono text-[0.65rem] text-[var(--foreground-muted)] uppercase tracking-wider mr-2">
          Filter:
        </span>
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleFilterChange(option.value)}
            className={`btn ${filter === option.value ? 'btn-ghost active' : 'btn-ghost'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {items.map((event, index) => (
          <div
            key={event.id}
            className="event-card-item animate-fade-up"
            style={{ animationDelay: `${(index % 12) * 40}ms` }}
          >
            <EventCard event={event} />
          </div>
        ))}
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="font-mono text-sm text-[var(--foreground-muted)]">No events found</p>
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
        <div className="relative aspect-square bg-[var(--card-solid)] overflow-hidden">
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--card-solid)] via-transparent to-transparent opacity-50 pointer-events-none" />
        </div>
      )}

      <div className="p-3 sm:p-4">
        <div className="flex items-start gap-2 mb-3">
          <h3 className="flex-1 font-medium text-sm text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
            {event.title}
          </h3>
          {event.closed ? (
            <span className="shrink-0 tag tag-danger">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-2.5 h-2.5 mr-1"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Resolved
            </span>
          ) : (
            <span className="shrink-0 tag tag-success">
              <span className="relative flex h-1 w-1 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1 w-1 bg-[var(--success)]"></span>
              </span>
              Live
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase">VOL</span>
            <span className="font-mono text-xs font-semibold text-[var(--accent)]">
              {formatVolume(event.volume)}
            </span>
          </div>

          <div className="w-6 h-6 rounded bg-[var(--card-solid)] flex items-center justify-center text-[var(--foreground-muted)] group-hover:bg-[var(--accent)] group-hover:text-[var(--background)] transition-all">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-3 h-3"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
