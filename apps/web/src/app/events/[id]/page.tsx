import type { Metadata } from 'next';
import { getEvent, formatVolume, isPlaceholderMarket, type IndexerMarket } from '@/lib/indexer';
import { buildOutcomeEntries, getMaxOutcomePrice, isBinaryYesNo, isNoOutcome, isYesOutcome } from '@/lib/outcomes';
import { shouldUseCompactTable, extractShortNames } from '@/lib/question-parser';
import Image from 'next/image';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// CLOB market status fetching (server-side, with concurrency limit + cache)
// ---------------------------------------------------------------------------

interface ClobStatus {
  closed: boolean;
  accepting_orders: boolean;
  enable_order_book: boolean;
}

const CLOB_BASE = 'https://clob.polymarket.com';
const CLOB_CONCURRENCY = 6;

// Simple in-memory cache (server-side, per-request lifecycle in Next.js but
// helps when multiple events share markets in the same server process)
const clobCache = new Map<string, { data: ClobStatus; ts: number }>();
const CACHE_TTL = 60_000; // 60s

async function fetchClobStatus(conditionId: string): Promise<ClobStatus | null> {
  const cached = clobCache.get(conditionId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const res = await fetch(`${CLOB_BASE}/markets/${conditionId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const status: ClobStatus = {
      closed: !!data.closed,
      accepting_orders: data.accepting_orders !== false,
      enable_order_book: data.enable_order_book !== false,
    };
    clobCache.set(conditionId, { data: status, ts: Date.now() });
    return status;
  } catch {
    return null;
  }
}

async function fetchClobStatuses(
  conditionIds: string[],
): Promise<Map<string, ClobStatus>> {
  const results = new Map<string, ClobStatus>();
  const unique = [...new Set(conditionIds)];

  // Process in batches of CLOB_CONCURRENCY
  for (let i = 0; i < unique.length; i += CLOB_CONCURRENCY) {
    const batch = unique.slice(i, i + CLOB_CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (cid) => {
        const status = await fetchClobStatus(cid);
        if (status) results.set(cid, status);
      }),
    );
  }

  return results;
}

type MarketStatus = 'live' | 'in_review' | 'closed';

function classifyMarket(
  market: IndexerMarket,
  clobStatus: ClobStatus | undefined,
): MarketStatus {
  // If indexer says closed → closed
  if (market.closed) return 'closed';

  // If CLOB says closed or orderbook disabled → closed
  if (clobStatus?.closed || clobStatus?.enable_order_book === false) return 'closed';

  // If indexer says active and not archived → check CLOB for accepting_orders
  if (market.active && !market.archived) {
    if (clobStatus && !clobStatus.accepting_orders) return 'in_review';
    return 'live';
  }

  // Indexer says not active (but not closed) — check CLOB as source of truth
  if (clobStatus) {
    if (!clobStatus.accepting_orders) return 'in_review';
    // CLOB says it's open but indexer disagrees — trust CLOB
    return 'live';
  }

  // No CLOB data, indexer says not active — treat as closed
  return 'closed';
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const event = await getEvent(id);
    const description = event.description
      ? event.description.length > 160
        ? event.description.slice(0, 157) + '...'
        : event.description
      : `Trade on ${event.title} at Neomarket`;
    return {
      title: event.title,
      description,
      openGraph: {
        title: event.title,
        description,
        type: 'article',
        url: `https://neomarket.bet/events/${id}`,
        ...(event.image && {
          images: [{ url: event.image, width: 1200, height: 630 }],
        }),
      },
      twitter: {
        card: event.image ? 'summary_large_image' : 'summary',
        title: event.title,
        description,
        ...(event.image && { images: [event.image] }),
      },
    };
  } catch {
    return { title: 'Event' };
  }
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function EventJsonLd({ event }: { event: { id: string; title: string; description: string | null; image: string | null; closed: boolean; markets?: { endDateIso: string | null }[] } }) {
  const endDate = event.markets?.find(m => m.endDateIso)?.endDateIso ?? null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || `Prediction market event: ${event.title}`,
    ...(event.image && { image: event.image }),
    ...(endDate && { endDate }),
    organizer: {
      '@type': 'Organization',
      name: 'Neomarket',
      url: 'https://neomarket.bet',
    },
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: event.closed
      ? 'https://schema.org/EventCancelled'
      : 'https://schema.org/EventScheduled',
    location: {
      '@type': 'VirtualLocation',
      url: `https://neomarket.bet/events/${event.id}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  const visibleMarkets = event.markets?.filter((m) => !isPlaceholderMarket(m)) ?? [];

  // Fetch CLOB status for all markets to get accurate live/closed/in-review
  const conditionIds = visibleMarkets.map((m) => m.conditionId);
  const clobStatuses = await fetchClobStatuses(conditionIds);

  // Classify each market
  const classified = visibleMarkets.map((m) => ({
    market: m,
    status: classifyMarket(m, clobStatuses.get(m.conditionId)),
  }));

  // Decide compact table vs card layout
  const useCompact = shouldUseCompactTable(visibleMarkets);
  const shortNamesList = useCompact
    ? extractShortNames(visibleMarkets.map((m) => m.question))
    : null;
  const shortNames = new Map<string, string>();
  if (shortNamesList) {
    visibleMarkets.forEach((m, i) => shortNames.set(m.id, shortNamesList[i]));
  }

  // Sort helper: compact mode sorts by YES probability desc, otherwise by 24h volume
  const sortMarkets = (arr: IndexerMarket[]) =>
    useCompact
      ? arr.sort((a, b) => (getYesPrice(b) ?? 0) - (getYesPrice(a) ?? 0))
      : arr.sort((a, b) => (b.volume24hr ?? 0) - (a.volume24hr ?? 0));

  const liveMarkets = sortMarkets(
    classified.filter((c) => c.status === 'live').map((c) => c.market),
  );

  const inReviewMarkets = sortMarkets(
    classified.filter((c) => c.status === 'in_review').map((c) => c.market),
  );

  const closedMarkets = sortMarkets(
    classified.filter((c) => c.status === 'closed').map((c) => c.market),
  );

  // Derive event expiry from the latest market endDateIso
  const eventEndDate = visibleMarkets
    .map((m) => m.endDateIso)
    .filter(Boolean)
    .sort()
    .pop() ?? null;

  // Derive event status from classified markets (indexer event flags are unreliable)
  const isEventResolved = liveMarkets.length === 0 && inReviewMarkets.length === 0 && closedMarkets.length > 0;
  const isEventLive = liveMarkets.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <EventJsonLd event={event} />
      <Link
        href="/events"
        className="inline-flex items-center gap-2 font-mono text-xs text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors uppercase tracking-wider"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-3.5 h-3.5"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back_To_Events
      </Link>

      <div className="relative">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-[var(--danger)]/5" />
        </div>

        <div className="glass-card p-4 sm:p-6">
          <div className="flex flex-col md:flex-row gap-5">
            {event.image && (
              <div className="relative w-full md:w-40 h-40 overflow-hidden shrink-0 ring-1 ring-[var(--card-border)]">
                <Image
                  src={event.image}
                  alt={event.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {isEventResolved ? (
                  <span className="tag tag-danger">
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
                ) : isEventLive ? (
                  <span className="tag tag-success">
                    <span className="relative flex h-1 w-1 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1 w-1 bg-[var(--success)]"></span>
                    </span>
                    Live
                  </span>
                ) : (
                  <span className="tag" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                    In Review
                  </span>
                )}
                {event.categories && event.categories.length > 0 && (
                  event.categories.map((cat) => {
                    const label = cat.includes('/') ? cat.split('/').pop()! : cat;
                    const displayLabel = label.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <Link
                        key={cat}
                        href={`/categories/${cat}`}
                        className="tag hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      >
                        {displayLabel}
                      </Link>
                    );
                  })
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-bold mb-4">{event.title}</h1>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <StatItem label="Volume" value={formatVolume(event.volume)} color="cyan" />
                <StatItem label="24h Vol" value={formatVolume(event.volume24hr)} color="cyan" />
                <StatItem label="Liquidity" value={formatVolume(event.liquidity)} color="green" />
                {liveMarkets.length > 0 ? (
                  <StatItem label="Live" value={String(liveMarkets.length)} color="green" />
                ) : (
                  <div>
                    <p className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider mb-0.5">
                      Live
                    </p>
                    <p className="font-mono font-bold text-sm text-[var(--danger)]">
                      0 live markets
                    </p>
                  </div>
                )}
                {eventEndDate && (
                  <StatItem label="Ends" value={formatDate(eventEndDate)} color="pink" />
                )}
              </div>
            </div>
          </div>

          {/* About Event — collapsible */}
          {event.description && (
            <details className="mt-5 pt-4 border-t border-[var(--card-border)]">
              <summary className="flex items-center gap-2 cursor-pointer select-none font-mono text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="w-1 h-4 bg-[var(--accent)] rounded-full" />
                About_Event
                <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 ml-auto transition-transform [[open]>&]:rotate-180" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <p className="mt-3 text-sm text-[var(--foreground-muted)] whitespace-pre-wrap leading-relaxed">
                {event.description}
              </p>
            </details>
          )}
        </div>
      </div>

      {/* Live Markets */}
      {liveMarkets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-gradient-to-b from-[var(--success)] to-[var(--accent)] rounded-full" />
            <h2 className="text-lg sm:text-xl font-bold">Live</h2>
            <span className="font-mono text-xs text-[var(--foreground-muted)]">({liveMarkets.length})</span>
          </div>
          {useCompact ? (
            <CompactMarketTable markets={liveMarkets} shortNames={shortNames} startRank={1} />
          ) : (
            <div className="space-y-3">
              {liveMarkets.map((market, index) => (
                <MarketCard key={market.id} market={market} index={index} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* In Review Markets */}
      {inReviewMarkets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-gradient-to-b from-yellow-500 to-yellow-500/30 rounded-full" />
            <h2 className="text-lg sm:text-xl font-bold text-yellow-500">In Review</h2>
            <span className="font-mono text-xs text-[var(--foreground-muted)]">({inReviewMarkets.length})</span>
          </div>

          <div className="opacity-85">
            {useCompact ? (
              <CompactMarketTable
                markets={inReviewMarkets}
                shortNames={shortNames}
                startRank={liveMarkets.length + 1}
              />
            ) : (
              <div className="space-y-3">
                {inReviewMarkets.map((market, index) => (
                  <MarketCard key={market.id} market={market} index={index} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resolved / Closed Markets */}
      {closedMarkets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-gradient-to-b from-[var(--foreground-muted)] to-transparent rounded-full" />
            <h2 className="text-lg sm:text-xl font-bold text-[var(--foreground-muted)]">Resolved</h2>
            <span className="font-mono text-xs text-[var(--foreground-muted)]">({closedMarkets.length})</span>
          </div>

          <div className="opacity-75">
            {useCompact ? (
              <CompactMarketTable
                markets={closedMarkets}
                shortNames={shortNames}
                startRank={liveMarkets.length + inReviewMarkets.length + 1}
              />
            ) : (
              <div className="space-y-3">
                {closedMarkets.map((market, index) => (
                  <MarketCard key={market.id} market={market} index={index} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getYesPrice(market: IndexerMarket): number | null {
  if (!market.outcomes || !market.outcomePrices) return null;
  const idx = market.outcomes.findIndex((o) => isYesOutcome(o));
  if (idx === -1) return null;
  const raw = market.outcomePrices[idx];
  const price = typeof raw === 'string' ? parseFloat(raw) : raw;
  return Number.isFinite(price) ? price : null;
}

function CompactMarketTable({
  markets,
  shortNames,
  startRank,
}: {
  markets: IndexerMarket[];
  shortNames: Map<string, string>;
  startRank: number;
}) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="hidden sm:flex items-center gap-2 px-4 py-2 border-b border-[var(--card-border)] text-[0.6rem] font-mono uppercase tracking-wider text-[var(--foreground-muted)]">
        <span className="w-8 text-center">#</span>
        <span className="flex-1 ml-2">Name</span>
        <span className="w-40 text-right">Probability</span>
        <span className="w-20 text-right hidden lg:block">Volume</span>
      </div>

      {/* Rows */}
      {markets.map((market, i) => {
        const rank = startRank + i;
        const name = shortNames.get(market.id) ?? market.question;
        const yesPrice = getYesPrice(market);
        const pct = yesPrice != null ? yesPrice * 100 : null;

        return (
          <Link
            key={market.id}
            href={`/market/${market.id}`}
            className="group flex items-center gap-2 px-4 py-1.5 sm:py-1 hover:bg-[var(--card-hover)] transition-colors border-b border-[var(--card-border)] last:border-b-0"
          >
            {/* Rank */}
            <span className="w-8 text-center font-mono text-xs text-[var(--foreground-muted)] shrink-0">
              {rank}
            </span>

            {/* Name + bar (mobile: stacked, desktop: inline) */}
            <div className="flex-1 ml-2 min-w-0">
              <span className="text-sm truncate block group-hover:text-[var(--accent)] transition-colors">
                {name}
              </span>
              {/* Mobile-only bar below name */}
              <div className="sm:hidden mt-1 price-bar" style={{ height: '3px' }}>
                <div
                  className="price-bar-fill"
                  style={{
                    width: `${pct ?? 0}%`,
                    background: 'linear-gradient(to right, var(--success), var(--success)/66)',
                    height: '3px',
                  }}
                />
              </div>
            </div>

            {/* Probability bar + percentage (desktop) */}
            <div className="hidden sm:flex items-center gap-2 w-40 shrink-0 justify-end">
              <div className="price-bar flex-1" style={{ height: '3px' }}>
                <div
                  className="price-bar-fill"
                  style={{
                    width: `${pct ?? 0}%`,
                    background: 'linear-gradient(to right, var(--success), var(--success)/66)',
                    height: '3px',
                  }}
                />
              </div>
              <span className="font-mono text-xs font-bold w-12 text-right text-[var(--success)]">
                {pct != null ? `${pct.toFixed(1)}%` : 'N/A'}
              </span>
            </div>

            {/* Mobile percentage */}
            <span className="sm:hidden font-mono text-xs font-bold text-[var(--success)] shrink-0">
              {pct != null ? `${pct.toFixed(1)}%` : 'N/A'}
            </span>

            {/* Volume (lg only) */}
            <span className="hidden lg:block w-20 text-right font-mono text-xs text-[var(--foreground-muted)] shrink-0">
              {formatVolume(market.volume)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function MarketCard({ market, index }: { market: IndexerMarket; index: number }) {
  const outcomes = buildOutcomeEntries(market.outcomes, market.outcomePrices);
  const maxPct = getMaxOutcomePrice(outcomes) * 100;
  const isBinary = isBinaryYesNo(market.outcomes);

  return (
    <Link
      key={market.id}
      href={`/market/${market.id}`}
      className="group block glass-card p-4 hover-lift animate-fade-up"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium group-hover:text-[var(--accent)] transition-colors mb-2">
            {market.question}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-[var(--foreground-muted)]">
              {formatVolume(market.volume)} vol
            </span>
            {market.volume24hr > 0 && (
              <span className="font-mono text-xs text-[var(--foreground-muted)]">
                {formatVolume(market.volume24hr)} 24h
              </span>
            )}
            {market.endDateIso && (
              <span className="font-mono text-xs text-[var(--foreground-muted)]">
                Ends {formatDate(market.endDateIso)}
              </span>
            )}
            {!isBinary && (
              <span className="font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase tracking-wider">
                Multi-outcome
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {outcomes.map((outcome) => {
            const isYes = isYesOutcome(outcome.label);
            const isNo = isNoOutcome(outcome.label);
            const bgClass = isYes
              ? 'bg-[var(--success-soft)] border border-[var(--success)]/20 group-hover:border-[var(--success)]/40'
              : isNo
                ? 'bg-[var(--danger-soft)] border border-[var(--danger)]/20 group-hover:border-[var(--danger)]/40'
                : 'bg-[var(--card)] border border-[var(--card-border)] group-hover:border-[var(--accent)]/40';
            const textClass = isYes
              ? 'text-[var(--success)]'
              : isNo
                ? 'text-[var(--danger)]'
                : 'text-[var(--accent)]';

            return (
              <div
                key={outcome.key}
                className={`px-3 py-2 text-center min-w-[70px] transition-all ${bgClass}`}
              >
                <div className={`font-mono text-[0.6rem] uppercase mb-0.5 ${textClass}`}>
                  {outcome.label}
                </div>
                <div className={`font-mono font-bold text-sm ${textClass}`}>
                  {outcome.price != null ? `${(outcome.price * 100).toFixed(1)}%` : 'N/A'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(() => {
        const leading = outcomes.reduce<typeof outcomes[0] | null>(
          (best, o) => (!best || (o.price ?? 0) > (best.price ?? 0) ? o : best),
          null
        );
        const barColor = leading && isNoOutcome(leading.label)
          ? 'var(--danger)'
          : 'var(--success)';
        return (
          <div className="mt-3 price-bar">
            <div
              className="price-bar-fill"
              style={{
                width: `${maxPct}%`,
                background: `linear-gradient(to right, ${barColor}, ${barColor}66)`,
              }}
            />
          </div>
        );
      })()}
    </Link>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'cyan' | 'green' | 'pink';
}) {
  const colors = {
    cyan: 'text-[var(--accent)]',
    green: 'text-[var(--success)]',
    pink: 'text-[var(--danger)]',
  };

  return (
    <div>
      <p className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className={`font-mono font-bold text-sm ${colors[color]}`}>{value}</p>
    </div>
  );
}
