'use client';

import Link from 'next/link';
import { Button } from '@app/ui';
import { useWalletStore } from '@/stores';

export function Header() {
  const { isConnected, address, isConnecting } = useWalletStore();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold">P</span>
          </div>
          <span className="font-semibold text-lg hidden sm:block">Polymarket</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          <Link
            href="/markets"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Markets
          </Link>
          <Link
            href="/portfolio"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Portfolio
          </Link>
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {isConnected && address ? (
            <Button variant="outline" size="sm">
              {formatAddress(address)}
            </Button>
          ) : (
            <Button size="sm" disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
