import type { Metadata } from 'next';
import { OpportunitiesTable } from '@/components/opportunities-table';

export const metadata: Metadata = {
  title: 'Opportunities',
  description:
    'Find high-probability prediction markets expiring soon. Buy cheap outcomes and collect $1 at resolution.',
  openGraph: {
    title: 'Opportunities',
    description:
      'Find high-probability prediction markets expiring soon. Buy cheap outcomes and collect $1 at resolution.',
    type: 'website',
    url: 'https://neomarket.bet/opportunities',
  },
  twitter: {
    card: 'summary',
    title: 'Opportunities | Neomarket',
    description:
      'Find high-probability prediction markets expiring soon. Buy cheap outcomes and collect $1 at resolution.',
  },
};

export default function OpportunitiesPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="relative">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-[var(--accent)] opacity-[0.06] blur-[80px] rounded-full pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-gradient-to-b from-[var(--accent)] to-[var(--success)] rounded-full" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Opportunities</h1>
          </div>
          <p className="text-sm text-[var(--foreground-muted)] font-mono max-w-xl">
            // High-probability markets expiring soon &mdash; buy cheap, collect $1 at resolution
          </p>
        </div>
      </div>

      <OpportunitiesTable />
    </div>
  );
}
