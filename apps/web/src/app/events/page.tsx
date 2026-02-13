import type { Metadata } from 'next';
import { EventsList } from '@/components/events-list';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Browse prediction market events on Neomarket',
  openGraph: {
    title: 'Events',
    description: 'Browse prediction market events on Neomarket',
    type: 'website',
    url: 'https://neomarket.bet/events',
  },
  twitter: {
    card: 'summary',
    title: 'Events | Neomarket',
    description: 'Browse prediction market events on Neomarket',
  },
};

export default function EventsPage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-gradient-to-b from-[var(--accent)] to-[var(--success)] rounded-full" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Events</h1>
      </div>

      <EventsList initialFilter="open" />
    </div>
  );
}
