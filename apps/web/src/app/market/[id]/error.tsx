'use client';

/**
 * Market page error boundary — catches errors on market detail pages.
 */

import { useEffect } from 'react';
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
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="font-mono text-xs text-[var(--danger)] mb-4 tracking-widest uppercase">
        // MARKET ERROR
      </div>
      <h1 className="text-2xl font-bold mb-2">Failed to load market</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {error.message || 'Could not load market data. The market may not exist or the service may be temporarily unavailable.'}
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" asChild>
          <a href="/markets">Browse Markets</a>
        </Button>
      </div>
    </div>
  );
}
