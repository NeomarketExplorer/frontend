import type { Metadata } from 'next';
import { EventsList } from '@/components/events-list';
import { EventSearch } from '@/components/event-search';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Browse prediction market events on Neomarket',
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string }>;
}) {
  const resolved = await searchParams;
  const searchQuery = typeof resolved?.search === 'string' ? resolved.search : undefined;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="relative">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-[var(--accent)] opacity-[0.06] blur-[80px] rounded-full pointer-events-none" />

        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-6 bg-gradient-to-b from-[var(--accent)] to-[var(--success)] rounded-full" />
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Events</h1>
              </div>
              <p className="text-sm text-[var(--foreground-muted)] font-mono max-w-xl">
                // Browse all prediction market events
              </p>
              {searchQuery && (
                <p className="mt-2 font-mono text-xs text-[var(--foreground-muted)]">
                  Showing results for "{searchQuery}"
                </p>
              )}
            </div>
            <EventSearch placeholder="Search events..." className="w-full sm:w-72" />
          </div>
        </div>
      </div>

      <EventsList initialFilter="open" searchQuery={searchQuery} />
    </div>
  );
}
