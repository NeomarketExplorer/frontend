'use client';

/**
 * Market page error boundary — catches errors on market detail pages.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@app/ui';

export default function MarketError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Market page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="glass-card p-8 sm:p-10 max-w-lg w-full text-center">
        {/* Terminal header */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-2 h-2 bg-[var(--danger)]" />
          <div className="w-2 h-2 bg-[var(--warning)]" />
          <div className="w-2 h-2 bg-[var(--foreground-muted)]" />
        </div>

        <div className="font-mono text-xs text-[var(--danger)] mb-4 tracking-widest uppercase">
          // MARKET ERROR
        </div>

        <h1 className="font-mono text-xl sm:text-2xl font-bold text-[var(--foreground)] mb-3">
          Failed to load market
        </h1>

        {/* Error message in terminal style */}
        <div className="bg-[var(--background)] border border-[var(--card-border)] p-4 mb-6 text-left">
          <p className="font-mono text-xs text-[var(--danger)] break-words">
            <span className="text-[var(--foreground-muted)]">{'> '}</span>
            {error.message || 'Could not load market data. The market may not exist or the service may be temporarily unavailable.'}
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-[var(--foreground-muted)] mt-2">
              <span className="text-[var(--foreground-muted)]">{'> '}</span>
              digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} className="font-mono uppercase tracking-wider text-xs">
            Try Again
          </Button>
          <Button variant="outline" asChild className="font-mono uppercase tracking-wider text-xs">
            <Link href="/markets">Browse Markets</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
