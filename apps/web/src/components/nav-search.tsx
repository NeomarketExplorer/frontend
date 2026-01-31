'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatVolume, getEvents, type IndexerEvent } from '@/lib/indexer';

export function NavSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexerEvent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const searchEvents = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await getEvents({
        limit: 6,
        offset: 0,
        search: searchQuery.trim(),
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
  }, []);

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

  const navigateToEvent = (event: IndexerEvent) => {
    setQuery('');
    setIsOpen(false);
    setResults([]);
    router.push(`/events/${event.id}`);
  };

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

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-3.5 h-3.5 text-[var(--foreground-muted)]"
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
          placeholder="Search events..."
          className="w-56 pl-8 pr-3 py-1.5 bg-[var(--card)] border border-[var(--card-border)] font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute right-0 z-50 w-[380px] mt-2 bg-[var(--card-solid)] border border-[var(--card-border)] shadow-2xl overflow-hidden">
          <div ref={resultsRef} className="max-h-[360px] overflow-y-auto divide-y divide-[var(--card-border)]">
            {results.map((event, index) => (
              <button
                key={event.id}
                data-result-item
                onClick={() => navigateToEvent(event)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full p-2.5 flex items-start gap-2.5 text-left transition-colors ${
                  index === selectedIndex ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--card)]'
                }`}
              >
                <div className="flex-shrink-0 w-10 h-10 overflow-hidden bg-[var(--card)] border border-[var(--card-border)]">
                  {event.image ? (
                    <Image
                      src={event.image}
                      alt=""
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--foreground-muted)]">
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-xs text-[var(--foreground)] line-clamp-2 leading-tight">
                    {event.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 text-[0.6rem] font-mono text-[var(--foreground-muted)]">
                    <span>{formatVolume(event.volume)} vol</span>
                    {event.active && (
                      <span className="flex items-center gap-0.5 text-[var(--success)]">
                        <span className="w-1 h-1 rounded-full bg-[var(--success)]" />
                        Live
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {query && (
            <div className="border-t border-[var(--card-border)] p-1.5">
              <button
                onClick={() => {
                  router.push(`/events?search=${encodeURIComponent(query)}`);
                  setIsOpen(false);
                }}
                className="w-full py-1.5 px-2 text-center font-mono text-[0.65rem] text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
              >
                View all results for &ldquo;{query}&rdquo; &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {isOpen && query && results.length === 0 && !isLoading && (
        <div className="absolute right-0 z-50 w-[300px] mt-2 bg-[var(--card-solid)] border border-[var(--card-border)] shadow-xl p-4 text-center">
          <p className="font-mono text-xs text-[var(--foreground-muted)]">No events found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
