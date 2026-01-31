import { getEvent, formatVolume } from '@/lib/indexer';
import { buildOutcomeEntries, getMaxOutcomePrice, isBinaryYesNo, isNoOutcome, isYesOutcome } from '@/lib/outcomes';
import Image from 'next/image';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);

  return (
    <div className="space-y-6 sm:space-y-8">
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
                {event.closed ? (
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
                ) : (
                  <span className="tag tag-success">
                    <span className="relative flex h-1 w-1 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1 w-1 bg-[var(--success)]"></span>
                    </span>
                    Live
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-bold mb-4">{event.title}</h1>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <StatItem label="Volume" value={formatVolume(event.volume)} color="cyan" />
                <StatItem label="Liquidity" value={formatVolume(event.liquidity)} color="green" />
                <StatItem label="Markets" value={String(event.markets?.length || 0)} color="pink" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {event.description && (
        <div className="glass-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-3">
            <span className="w-1 h-4 bg-[var(--accent)] rounded-full" />
            About_Event
          </h2>
          <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-wrap leading-relaxed">
            {event.description}
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-gradient-to-b from-[var(--success)] to-[var(--accent)] rounded-full" />
          <h2 className="text-lg sm:text-xl font-bold">Markets</h2>
          <span className="font-mono text-xs text-[var(--foreground-muted)]">({event.markets?.length || 0})</span>
        </div>

        {event.markets && event.markets.length > 0 ? (
          <div className="space-y-3">
            {[...event.markets]
              .sort((a, b) => {
                const aMax = getMaxOutcomePrice(buildOutcomeEntries(a.outcomes, a.outcomePrices));
                const bMax = getMaxOutcomePrice(buildOutcomeEntries(b.outcomes, b.outcomePrices));
                return bMax - aMax;
              })
              .map((market, index) => {
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
                        <span className="font-mono text-xs text-[var(--foreground-muted)]">
                          {formatVolume(market.volume)}
                        </span>
                        {!isBinary && (
                          <span className="ml-2 font-mono text-[0.55rem] text-[var(--foreground-muted)] uppercase tracking-wider">
                            Multi-outcome
                          </span>
                        )}
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
              })}
          </div>
        ) : (
          <div className="glass-card p-10 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--card)] mb-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-7 h-7 text-[var(--foreground-muted)]"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            </div>
            <p className="font-mono text-sm text-[var(--foreground-muted)]">No markets found</p>
          </div>
        )}
      </div>
    </div>
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
