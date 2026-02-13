'use client';

import { usePathname } from 'next/navigation';
import { SearchBar } from '@/components/search-bar';

export function NavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketPage = pathname.startsWith('/market/');

  return (
    <div className={isMarketPage ? 'px-4' : 'max-w-7xl mx-auto px-4 sm:px-6'}>
      {children}
    </div>
  );
}

export function MobileNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketPage = pathname.startsWith('/market/');

  if (isMarketPage) return null;

  return (
    <div className="sm:hidden sticky top-14 z-40 backdrop-blur-xl bg-[var(--background)]/90 border-b border-[var(--card-border)]">
      <div className="flex items-center justify-center gap-1 px-4 py-1.5 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketPage = pathname.startsWith('/market/');

  if (isMarketPage) {
    return (
      <main id="main-content" className="w-full">
        {children}
      </main>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
        <SearchBar />
      </div>
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-6 sm:pt-6 sm:pb-8">
        {children}
      </main>
      <footer className="border-t border-[var(--card-border)] mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-[var(--foreground-muted)] uppercase tracking-wider">
                Data Source:
              </span>
              <span className="font-mono font-semibold text-[var(--accent)]">
                Polymarket
              </span>
            </div>
            <div className="font-mono text-[0.65rem] text-[var(--foreground-muted)] tracking-widest uppercase">
              v1.0.0 // Next.js + TypeScript
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="font-mono text-[0.65rem] text-[var(--foreground-muted)] uppercase tracking-wider">
                All Systems Operational
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
