/**
 * Custom 404 page — shown when a route doesn't match any known page.
 * Uses the terminal/hacker aesthetic consistent with error.tsx.
 */

import Link from 'next/link';
import { Button } from '@app/ui';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="glass-card p-8 sm:p-10 max-w-lg w-full text-center">
        {/* Terminal header dots */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-2 h-2 bg-[var(--danger)]" />
          <div className="w-2 h-2 bg-[var(--warning)]" />
          <div className="w-2 h-2 bg-[var(--foreground-muted)]" />
        </div>

        <div className="font-mono text-xs text-[var(--danger)] mb-4 tracking-widest uppercase">
          // 404 NOT FOUND
        </div>

        <h1 className="font-mono text-4xl sm:text-5xl font-bold text-[var(--foreground)] mb-3 text-glow-danger">
          404
        </h1>

        {/* Terminal-style message */}
        <div className="bg-[var(--background)] border border-[var(--card-border)] p-4 mb-6 text-left">
          <p className="font-mono text-xs text-[var(--foreground-muted)]">
            <span className="text-[var(--danger)]">{'> '}</span>
            Page not found
          </p>
          <p className="font-mono text-xs text-[var(--foreground-muted)] mt-2">
            <span className="text-[var(--danger)]">{'> '}</span>
            The requested route does not exist or has been moved.
          </p>
          <p className="font-mono text-xs text-[var(--accent)] mt-2 flicker">
            <span className="text-[var(--foreground-muted)]">{'> '}</span>
            Awaiting navigation input_
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button asChild className="font-mono uppercase tracking-wider text-xs">
            <Link href="/">Go Home</Link>
          </Button>
          <Button variant="outline" asChild className="font-mono uppercase tracking-wider text-xs">
            <Link href="/markets">Browse Markets</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
