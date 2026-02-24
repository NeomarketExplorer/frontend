'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@app/ui';

export default function MarketsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Markets page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="font-mono text-xs text-[var(--danger)] mb-4 tracking-widest uppercase">
        // MARKETS ERROR
      </div>
      <h1 className="text-2xl font-bold mb-2">Failed to load markets</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {error.message || 'Could not load markets. Please try again.'}
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
