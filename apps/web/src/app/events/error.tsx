'use client';

import { useEffect } from 'react';
import { Button } from '@app/ui';

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Events page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="font-mono text-xs text-[var(--danger)] mb-4 tracking-widest uppercase">
        // EVENTS ERROR
      </div>
      <h1 className="text-2xl font-bold mb-2">Failed to load events</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {error.message || 'Could not load events. Please try again.'}
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" asChild>
          <a href="/">Go Home</a>
        </Button>
      </div>
    </div>
  );
}
