'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTitle } from '@app/ui';
import { formatVolume, getEvents, searchMarkets, type IndexerEvent, type IndexerMarket } from '@/lib/indexer';

// Custom event name used to open the dialog from anywhere
const OPEN_SEARCH_EVENT = 'open-search';

/** Dispatch this event to open the search dialog from any component. */
export function openSearchDialog() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

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

/**
 * Small search icon button for the header nav.
 * Dispatches a custom event to open the SearchDialog.
 */
export function SearchTrigger() {
  return (
    <button
      onClick={() => openSearchDialog()}
      className="flex items-center justify-center w-9 h-9 bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
      aria-label="Search (Cmd+K)"
      title="Search (Cmd+K)"
    >
      <SearchIcon className="w-4 h-4" />
    </button>
  );
}

/**
 * Global search dialog.
 *
 * Mount once in the root layout. It listens for:
 * - Cmd+K / Ctrl+K keyboard shortcut
 * - `open-search` custom event (from SearchTrigger or other components)
 *
 * Renders a Radix Dialog portal with search input, grouped results
 * (Events + Markets), keyboard navigation, and mobile full-screen support.
 */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexerEvent[]>([]);
  const [marketResults, setMarketResults] = useState<IndexerMarket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const totalResults = results.length + marketResults.length;

  // ── Global keyboard shortcut: Cmd+K / Ctrl+K ─────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Custom event listener (for SearchTrigger and SearchBarTrigger) ─
  useEffect(() => {
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener(OPEN_SEARCH_EVENT, handleOpenEvent);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, handleOpenEvent);
  }, []);

  // ── Focus input when dialog opens ─────────────────────────────────
  useEffect(() => {
    if (open) {
      // Radix Dialog handles focus, but we want the input specifically
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      // Reset on close
      setQuery('');
      setResults([]);
      setMarketResults([]);
      setSelectedIndex(-1);
    }
  }, [open]);

  // ── Debounced search ──────────────────────────────────────────────
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setMarketResults([]);
      return;
    }

    setIsLoading(true);
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
    } catch {
      setResults([]);
      setMarketResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search, open]);

  // ── Scroll selected item into view ────────────────────────────────
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const items = resultsRef.current.querySelectorAll('[data-result-item]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // ── Navigation helpers ────────────────────────────────────────────
  const navigateToEvent = useCallback((event: IndexerEvent) => {
    setOpen(false);
    router.push(`/events/${event.id}`);
  }, [router]);

  const navigateToMarket = useCallback((market: IndexerMarket) => {
    setOpen(false);
    router.push(`/market/${market.id}`);
  }, [router]);

  // ── Keyboard navigation ───────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (totalResults > 0) {
          setSelectedIndex((prev) => (prev < totalResults - 1 ? prev + 1 : prev));
        }
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
          setOpen(false);
        }
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="!top-[15%] !translate-y-0 !p-0 !gap-0 max-sm:!top-0 max-sm:!left-0 max-sm:!translate-x-0 max-sm:!w-full max-sm:!h-full max-sm:!max-w-none max-sm:!border-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--card-border)]">
            <div className="flex-shrink-0">
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
              placeholder="Search markets & events..."
              className="flex-1 bg-transparent font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none"
              autoComplete="off"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 font-mono text-[0.6rem] text-[var(--foreground-muted)] border border-[var(--card-border)] bg-[var(--background)]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={resultsRef} className="max-h-[60vh] max-sm:max-h-[calc(100vh-60px)] overflow-y-auto">
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

            {query && totalResults === 0 && !isLoading && (
              <div className="p-6 text-center">
                <p className="font-mono text-xs text-[var(--foreground-muted)]">
                  No results found for &ldquo;{query}&rdquo;
                </p>
              </div>
            )}

            {!query && (
              <div className="p-6 text-center">
                <p className="font-mono text-xs text-[var(--foreground-muted)]">
                  Type to search events and markets
                </p>
              </div>
            )}
          </div>

          {/* Footer: View all results */}
          {query && totalResults > 0 && (
            <div className="border-t border-[var(--card-border)] p-2">
              <button
                onClick={() => {
                  router.push(`/events?search=${encodeURIComponent(query)}`);
                  setOpen(false);
                }}
                className="w-full py-2 px-2 text-center font-mono text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors min-h-[44px]"
              >
                View all results for &ldquo;{query}&rdquo; &rarr;
              </button>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
