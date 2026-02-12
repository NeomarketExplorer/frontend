import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { QueryProvider } from '@/providers/query-provider';
import { PrivyProvider } from '@/providers/privy-provider';
import { ClobAuthProvider } from '@/providers/clob-auth-provider';
import { WagmiProvider } from '@/providers/wagmi-provider';
import { ConnectButton } from '@/components/connect-button';
import { SearchBar } from '@/components/search-bar';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://neomarket.bet'),
  title: {
    default: 'Neomarket',
    template: '%s | Neomarket',
  },
  description:
    'Trade prediction markets on Polymarket. Real-time odds, orderbook trading, and portfolio tracking.',
  openGraph: {
    title: 'Neomarket',
    description:
      'Trade prediction markets on Polymarket. Real-time odds, orderbook trading, and portfolio tracking.',
    siteName: 'Neomarket',
    locale: 'en_US',
    type: 'website',
    url: 'https://neomarket.bet',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@neomarket',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0d0f12" />
      </head>
      <body className="min-h-screen antialiased">
        <PrivyProvider>
          <QueryProvider>
            <WagmiProvider>
            <ClobAuthProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-[var(--background)] focus:font-mono focus:text-sm"
              >
                Skip to main content
              </a>

              <div className="grid-pattern" aria-hidden="true" />

              {/* Navigation */}
              <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--background)]/90 border-b border-[var(--card-border)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                  <div className="flex items-center justify-between h-14 gap-4">
                    {/* Logo */}
                    <a href="/" className="flex items-center gap-2.5 group">
                      <div className="relative w-7 h-7 bg-gradient-to-br from-[var(--accent)] to-[var(--success)] flex items-center justify-center group-hover:glow-accent transition-all duration-300">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="w-4 h-4 text-[var(--background)]"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                          <polyline points="16 7 22 7 22 13" />
                        </svg>
                      </div>
                      <div className="flex items-baseline gap-0.5">
                        <span className="font-mono text-sm font-bold tracking-tight text-[var(--foreground)]">
                          NEO
                        </span>
                        <span className="font-mono text-sm font-bold tracking-tight text-[var(--accent)]">
                          MARKET
                        </span>
                      </div>
                    </a>

                    {/* Desktop Nav */}
                    <div className="hidden sm:flex items-center gap-0.5">
                      <NavLink href="/events" label="Events" />
                      <NavLink href="/markets" label="Markets" />
                      <NavLink href="/categories" label="Categories" />
                      <NavLink href="/portfolio" label="Portfolio" />
                      <NavLink href="/leaderboard" label="Leaderboard" />
                    </div>

                    {/* Connect */}
                    <div className="flex items-center gap-3">
                      <ConnectButton />
                    </div>
                  </div>
                </div>
              </nav>

              {/* Mobile Nav */}
              <div className="sm:hidden sticky top-14 z-40 backdrop-blur-xl bg-[var(--background)]/90 border-b border-[var(--card-border)]">
                <div className="flex items-center justify-center gap-1 px-4 py-1.5 overflow-x-auto">
                  <NavLink href="/events" label="Events" />
                  <NavLink href="/markets" label="Markets" />
                  <NavLink href="/categories" label="Categories" />
                  <NavLink href="/portfolio" label="Portfolio" />
                  <NavLink href="/leaderboard" label="Leaderboard" />
                </div>
              </div>

              {/* Search Bar */}
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
            </ClobAuthProvider>
            </WagmiProvider>
          </QueryProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="nav-link">
      {label}
    </a>
  );
}
