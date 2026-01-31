import { MarketsList } from '@/components/markets-list';

export default function MarketsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="relative">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-[var(--danger)] opacity-[0.06] blur-[80px] rounded-full pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-gradient-to-b from-[var(--success)] to-[var(--danger)] rounded-full" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Markets</h1>
          </div>
          <p className="text-sm text-[var(--foreground-muted)] font-mono max-w-xl">
            // Explore individual prediction markets
          </p>
        </div>
      </div>

      <MarketsList initialSort="volume" />
    </div>
  );
}
