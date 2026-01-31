'use client';

/**
 * Root error boundary — catches unhandled errors across the app.
 */

import { useEffect } from 'react';
import { Button } from '@app/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="font-mono text-xs text-[var(--danger)] mb-4 tracking-widest uppercase">
        // ERROR
      </div>
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-4 font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
