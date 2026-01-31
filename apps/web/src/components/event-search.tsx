'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatVolume, getEvents, type IndexerEvent } from '@/lib/indexer';

interface EventSearchProps {
  placeholder?: string;
  className?: string;
  showOnlyLive?: boolean;
}

export function EventSearch({
  placeholder = 'Search events...',
  className = '',
  showOnlyLive = false,
}: EventSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexerEvent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const searchEvents = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await getEvents({
          limit: 8,
          offset: 0,
          search: searchQuery.trim(),
          active: showOnlyLive ? true : undefined,
          closed: showOnlyLive ? false : undefined,
          sort: 'volume',
          order: 'desc',
        });
        setResults(res.data || []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [showOnlyLive]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      searchEvents(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, searchEvents]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const items = resultsRef.current.querySelectorAll('[data-result-item]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        router.push(`/events?search=${encodeURIComponent(query)}`);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          navigateToEvent(results[selectedIndex]);
        } else if (query.trim()) {
          router.push(`/events?search=${encodeURIComponent(query)}`);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const navigateToEvent = (event: IndexerEvent) => {
    setQuery('');
    setIsOpen(false);
    setResults([]);
    router.push(`/events/${event.id}`);
  };

  const getStatusBadge = (event: IndexerEvent) => {
    if (event.closed) {
      return (
        <span className="tag tag-accent text-[0.55rem] py-0.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-2.5 h-2.5 mr-0.5"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Resolved
        </span>
      );
    }
    if (event.active) {
      return (
        <span className="tag tag-success text-[0.55rem] py-0.5">
          <span className="relative flex h-1.5 w-1.5 mr-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--success)]"></span>
          </span>
          Live
        </span>
      );
    }
    return null;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-4 h-4 text-[var(--foreground-muted)]"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--card-border)] font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-4 h-4"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-[var(--card-solid)] border border-[var(--card-border)] shadow-2xl overflow-hidden min-w-[320px]">
          <div
            ref={resultsRef}
            className="max-h-[420px] overflow-y-auto divide-y divide-[var(--card-border)]"
          >
            {results.map((event, index) => (
              <button
                key={event.id}
                data-result-item
                onClick={() => navigateToEvent(event)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full p-3 flex items-start gap-3 text-left transition-colors ${
                  index === selectedIndex ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--card)]'
                }`}
              >
                <div className="flex-shrink-0 w-14 h-14 overflow-hidden bg-[var(--card)] border border-[var(--card-border)]">
                  {event.image ? (
                    <Image
                      src={event.image}
                      alt=""
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--foreground-muted)]">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="w-6 h-6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm text-[var(--foreground)] line-clamp-2 leading-tight">
                      {event.title}
                    </h4>
                    {getStatusBadge(event)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[0.65rem] font-mono text-[var(--foreground-muted)]">
                    <span className="flex items-center gap-1">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="w-3 h-3"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                      {formatVolume(event.volume)}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="w-3 h-3"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 2v20M2 12h20" />
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                      {formatVolume(event.liquidity)} liq
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {query && (
            <div className="border-t border-[var(--card-border)] p-2">
              <button
                onClick={() => {
                  router.push(`/events?search=${encodeURIComponent(query)}`);
                  setIsOpen(false);
                }}
                className="w-full py-2 px-3 text-center font-mono text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
              >
                View all results for "{query}" -&gt;
              </button>
            </div>
          )}
        </div>
      )}

      {isOpen && query && results.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-2 bg-[var(--card-solid)] border border-[var(--card-border)] shadow-xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-[var(--card)] mb-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5 text-[var(--foreground-muted)]"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <p className="font-mono text-sm text-[var(--foreground-muted)]">No events found for "{query}"</p>
          <p className="font-mono text-xs text-[var(--foreground-muted)] mt-1 opacity-70">Try different keywords</p>
        </div>
      )}
    </div>
  );
}
