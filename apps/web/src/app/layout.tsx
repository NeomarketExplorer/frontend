import type { Metadata } from 'next';
import Link from 'next/link';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { QueryProvider } from '@/providers/query-provider';
import { PrivyProvider } from '@/providers/privy-provider';
import { ClobAuthProvider } from '@/providers/clob-auth-provider';
import { WagmiProvider } from '@/providers/wagmi-provider';
import { ConnectButton } from '@/components/connect-button';
import { LayoutShell, NavWrapper, MobileNav } from '@/components/layout-shell';
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
                <NavWrapper>
                  <div className="flex items-center justify-between h-14 gap-4">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5 group">
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
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden sm:flex items-center gap-0.5">
                      <NavLink href="/events" label="Events" />
                      <NavLink href="/markets" label="Markets" />
                      <NavLink href="/opportunities" label="Opportunities" />
                      <NavLink href="/categories" label="Categories" />
                      <NavLink href="/portfolio" label="Portfolio" />
                      <NavLink href="/leaderboard" label="Leaderboard" />
                    </div>

                    {/* Connect */}
                    <div className="flex items-center gap-3">
                      <ConnectButton />
                    </div>
                  </div>
                </NavWrapper>
              </nav>

              {/* Mobile Nav (hidden on market terminal pages) */}
              <MobileNav>
                <NavLink href="/events" label="Events" />
                <NavLink href="/markets" label="Markets" />
                <NavLink href="/opportunities" label="Opportunities" />
                <NavLink href="/categories" label="Categories" />
                <NavLink href="/portfolio" label="Portfolio" />
                <NavLink href="/leaderboard" label="Leaderboard" />
              </MobileNav>

              <LayoutShell>
                {children}
              </LayoutShell>
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
    <Link href={href} className="nav-link">
      {label}
    </Link>
  );
}
