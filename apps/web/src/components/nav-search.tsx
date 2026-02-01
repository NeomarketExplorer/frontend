'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatVolume, getEvents, searchMarkets, type IndexerEvent, type IndexerMarket } from '@/lib/indexer';

export function NavSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexerEvent[]>([]);
  const [marketResults, setMarketResults] = useState<IndexerMarket[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const totalResults = results.length + marketResults.length;

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setMarketResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const [eventsResult, marketsResult] = await Promise.allSettled([
        getEvents({
          limit: 4,
          offset: 0,
          search: searchQuery.trim(),
          sort: 'volume',
          order: 'desc',
        }),
        searchMarkets(searchQuery.trim(), 4),
      ]);

      const events = eventsResult.status === 'fulfilled' ? (eventsResult.value.data || []) : [];
      const markets = marketsResult.status === 'fulfilled' ? (marketsResult.value || []) : [];

      setResults(events);
      setMarketResults(markets);
      setIsOpen(events.length > 0 || markets.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setMarketResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, search]);

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
    setMarketResults([]);
    router.push(`/events/${event.id}`);
  };

  const navigateToMarket = (market: IndexerMarket) => {
    setQuery('');
    setIsOpen(false);
    setResults([]);
    setMarketResults([]);
    router.push(`/market/${market.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || totalResults === 0) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        router.push(`/events?search=${encodeURIComponent(query)}`);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalResults - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < results.length) {
            navigateToEvent(results[selectedIndex]);
          } else {
            const marketIndex = selectedIndex - results.length;
            if (marketResults[marketIndex]) {
              navigateToMarket(marketResults[marketIndex]);
            }
          }
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
            if (results.length > 0 || marketResults.length > 0) setIsOpen(true);
          }}
          placeholder="Search markets..."
          className="w-56 pl-8 pr-3 py-1.5 bg-[var(--card)] border border-[var(--card-border)] font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setMarketResults([]);
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

      {isOpen && totalResults > 0 && (
        <div className="absolute right-0 z-50 w-[420px] mt-2 bg-[var(--card-solid)] border border-[var(--card-border)] shadow-2xl overflow-hidden">
          <div ref={resultsRef} className="max-h-[360px] overflow-y-auto">
            {results.length > 0 && (
              <>
                <div className="px-2.5 py-1.5 text-[0.6rem] font-mono text-[var(--foreground-muted)] uppercase tracking-widest bg-[var(--background)]">
                  Events
                </div>
                <div className="divide-y divide-[var(--card-border)]">
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
              </>
            )}

            {marketResults.length > 0 && (
              <>
                <div className="px-2.5 py-1.5 text-[0.6rem] font-mono text-[var(--foreground-muted)] uppercase tracking-widest bg-[var(--background)]">
                  Markets
                </div>
                <div className="divide-y divide-[var(--card-border)]">
                  {marketResults.map((market, index) => {
                    const flatIndex = results.length + index;
                    return (
                      <button
                        key={market.id}
                        data-result-item
                        onClick={() => navigateToMarket(market)}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        className={`w-full p-2.5 flex items-start gap-2.5 text-left transition-colors ${
                          flatIndex === selectedIndex ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--card)]'
                        }`}
                      >
                        <div className="flex-shrink-0 w-10 h-10 overflow-hidden bg-[var(--card)] border border-[var(--card-border)]">
                          {market.image ? (
                            <Image
                              src={market.image}
                              alt=""
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--foreground-muted)]">
                              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
                                <path d="M3 3v18h18" />
                                <path d="M7 16l4-8 4 4 5-10" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-xs text-[var(--foreground)] line-clamp-1 leading-tight">
                            {market.question}
                          </h4>
                          <div className="mt-1 flex items-center gap-2 text-[0.6rem] font-mono text-[var(--foreground-muted)]">
                            <span className="text-[var(--accent)]">
                              {(market.outcomePrices[0] * 100).toFixed(0)}&cent; YES
                            </span>
                            <span>{formatVolume(market.volume)} vol</span>
                            {market.active && (
                              <span className="flex items-center gap-0.5 text-[var(--success)]">
                                <span className="w-1 h-1 rounded-full bg-[var(--success)]" />
                                Live
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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

      {isOpen && query && totalResults === 0 && !isLoading && (
        <div className="absolute right-0 z-50 w-[300px] mt-2 bg-[var(--card-solid)] border border-[var(--card-border)] shadow-xl p-4 text-center">
          <p className="font-mono text-xs text-[var(--foreground-muted)]">No results found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
