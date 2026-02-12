'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatVolume, getEvents, searchMarkets, type IndexerEvent, type IndexerMarket } from '@/lib/indexer';

function sortByLiveness<T extends { active?: boolean; closed?: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const scoreA = a.closed ? 0 : a.active ? 2 : 1;
    const scoreB = b.closed ? 0 : b.active ? 2 : 1;
    return scoreB - scoreA;
  });
}

const SearchIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexerEvent[]>([]);
  const [marketResults, setMarketResults] = useState<IndexerMarket[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [mobileOpen, setMobileOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
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
    setIsOpen(true);
    try {
      const [eventsResult, marketsResult] = await Promise.allSettled([
        getEvents({ limit: 4, offset: 0, search: searchQuery.trim(), sort: 'volume', order: 'desc' }),
        searchMarkets(searchQuery.trim(), 4),
      ]);

      const events = eventsResult.status === 'fulfilled' ? (eventsResult.value.data || []) : [];
      const markets = marketsResult.status === 'fulfilled' ? (marketsResult.value || []) : [];

      setResults(sortByLiveness(events));
      setMarketResults(sortByLiveness(markets));
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setMarketResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { search(query); }, 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const items = resultsRef.current.querySelectorAll('[data-result-item]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Focus mobile input when overlay opens
  useEffect(() => {
    if (mobileOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 100);
    }
  }, [mobileOpen]);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setMobileOpen(true);
        } else {
          inputRef.current?.focus();
        }
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const clearAndClose = () => {
    setQuery('');
    setIsOpen(false);
    setResults([]);
    setMarketResults([]);
    setMobileOpen(false);
  };

  const navigateToEvent = (event: IndexerEvent) => {
    clearAndClose();
    router.push(`/events/${event.id}`);
  };

  const navigateToMarket = (market: IndexerMarket) => {
    clearAndClose();
    router.push(`/market/${market.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && mobileOpen) {
      clearAndClose();
      return;
    }

    if (!isOpen || totalResults === 0) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        router.push(`/events?search=${encodeURIComponent(query)}`);
        clearAndClose();
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
          clearAndClose();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const renderStatusBadge = (item: { active?: boolean; closed?: boolean }) => {
    if (item.closed) {
      return <span className="text-[var(--foreground-muted)]">Resolved</span>;
    }
    if (item.active) {
      return (
        <span className="flex items-center gap-0.5 text-[var(--success)]">
          <span className="w-1 h-1 rounded-full bg-[var(--success)]" />
          Live
        </span>
      );
    }
    return <span className="text-[var(--foreground-muted)]">In Review</span>;
  };

  const renderResultsContent = () => (
    <>
      <div ref={resultsRef} className="max-h-[60vh] md:max-h-[400px] overflow-y-auto">
        {results.length > 0 && (
          <>
            <div className="px-3 py-2 text-[0.6rem] font-mono text-[var(--foreground-muted)] uppercase tracking-widest bg-[var(--background)]">
              Events
            </div>
            <div className="divide-y divide-[var(--card-border)]">
              {results.map((event, index) => (
                <button
                  key={event.id}
                  data-result-item
                  onClick={() => navigateToEvent(event)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full p-3 flex items-start gap-3 text-left transition-colors min-h-[44px] ${
                    index === selectedIndex ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--card)]'
                  }`}
                >
                  <div className="flex-shrink-0 w-10 h-10 overflow-hidden bg-[var(--card)] border border-[var(--card-border)]">
                    {event.image ? (
                      <Image src={event.image} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
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
                    <h4 className="font-medium text-sm text-[var(--foreground)] line-clamp-2 leading-tight">
                      {event.title}
                    </h4>
                    <div className="mt-1 flex items-center gap-2 text-[0.65rem] font-mono text-[var(--foreground-muted)]">
                      <span>{formatVolume(event.volume)} vol</span>
                      {renderStatusBadge(event)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {marketResults.length > 0 && (
          <>
            <div className="px-3 py-2 text-[0.6rem] font-mono text-[var(--foreground-muted)] uppercase tracking-widest bg-[var(--background)]">
              Markets
            </div>
            <div className="divide-y divide-[var(--card-border)]">
              {marketResults.map((market, index) => {
                const flatIndex = results.length + index;
                const yesPrice = market.outcomePrices?.[0];
                return (
                  <button
                    key={market.id}
                    data-result-item
                    onClick={() => navigateToMarket(market)}
                    onMouseEnter={() => setSelectedIndex(flatIndex)}
                    className={`w-full p-3 flex items-start gap-3 text-left transition-colors min-h-[44px] ${
                      flatIndex === selectedIndex ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--card)]'
                    }`}
                  >
                    <div className="flex-shrink-0 w-10 h-10 overflow-hidden bg-[var(--card)] border border-[var(--card-border)]">
                      {market.image ? (
                        <Image src={market.image} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
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
                      <h4 className="font-medium text-sm text-[var(--foreground)] line-clamp-1 leading-tight">
                        {market.question}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-[0.65rem] font-mono text-[var(--foreground-muted)]">
                        {yesPrice != null && (
                          <span className="text-[var(--accent)]">
                            {(yesPrice * 100).toFixed(0)}&cent; YES
                          </span>
                        )}
                        <span>{formatVolume(market.volume)} vol</span>
                        {renderStatusBadge(market)}
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
        <div className="border-t border-[var(--card-border)] p-2">
          <button
            onClick={() => {
              router.push(`/events?search=${encodeURIComponent(query)}`);
              clearAndClose();
            }}
            className="w-full py-2 px-2 text-center font-mono text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors min-h-[44px]"
          >
            View all results for &ldquo;{query}&rdquo; &rarr;
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop: full-width inline search with dropdown */}
      <div ref={containerRef} className="relative hidden md:block">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <SearchIcon className="w-4 h-4 text-[var(--foreground-muted)]" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.trim() && (results.length > 0 || marketResults.length > 0)) setIsOpen(true);
            }}
            placeholder="Search markets & events...  &#8984;K"
            className="w-full pl-11 pr-10 py-3 bg-[var(--card)] border border-[var(--card-border)] font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
            autoComplete="off"
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
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Desktop dropdown - full width */}
        {isOpen && totalResults > 0 && (
          <div className="absolute left-0 right-0 z-50 mt-1 bg-[var(--card-solid)] border border-[var(--card-border)] shadow-2xl overflow-hidden">
            {renderResultsContent()}
          </div>
        )}

        {isOpen && query && totalResults === 0 && !isLoading && (
          <div className="absolute left-0 right-0 z-50 mt-1 bg-[var(--card-solid)] border border-[var(--card-border)] shadow-xl p-4 text-center">
            <p className="font-mono text-xs text-[var(--foreground-muted)]">No results found for &ldquo;{query}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Mobile: full-width search trigger */}
      <button
        className="md:hidden w-full flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] text-left"
        onClick={() => setMobileOpen(true)}
      >
        <SearchIcon className="w-4 h-4 text-[var(--foreground-muted)] flex-shrink-0" />
        <span className="font-mono text-sm text-[var(--foreground-muted)]">
          Search markets & events...
        </span>
      </button>

      {/* Mobile: full-screen search overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[100] bg-[var(--background)] flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--card-border)]">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <SearchIcon className="w-4 h-4 text-[var(--foreground-muted)]" />
                )}
              </div>
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search markets & events..."
                className="w-full pl-10 pr-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all min-h-[44px]"
                autoComplete="off"
              />
            </div>
            <button
              onClick={clearAndClose}
              className="flex items-center justify-center w-10 h-10 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Close search"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isOpen && totalResults > 0 && renderResultsContent()}
            {isOpen && query && totalResults === 0 && !isLoading && (
              <div className="p-4 text-center">
                <p className="font-mono text-xs text-[var(--foreground-muted)]">No results found for &ldquo;{query}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
