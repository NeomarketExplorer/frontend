'use client';

import { Button } from '@app/ui';
import { useAuth } from '@/hooks/use-auth';
import { useWalletStore } from '@/stores';
import { usePrivyAvailable } from '@/providers/privy-provider';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export function ConnectButton() {
  const privyAvailable = usePrivyAvailable();
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!privyAvailable) {
    const label = appId ? 'HTTPS required' : 'Auth disabled';
    const title = appId
      ? 'Wallet login requires HTTPS. Connect via your https domain.'
      : 'Set NEXT_PUBLIC_PRIVY_APP_ID to enable auth.';
    return (
      <Button size="sm" disabled title={title}>
        {label}
      </Button>
    );
  }

  return <ConnectButtonInner />;
}

function ConnectButtonInner() {
  const { isReady, isAuthenticated, login, logout } = useAuth();
  const { address, isConnecting, softDisconnected, softDisconnect, resume } = useWalletStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  useEffect(() => {
    if (!menuOpen) {
      setCopied(false);
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  if (!isReady || isConnecting) {
    return (
      <Button size="sm" disabled>
        Loading...
      </Button>
    );
  }

  if (isAuthenticated && address) {
    return (
      <div className="relative flex items-center gap-2">
        <Button
          ref={buttonRef}
          variant="outline"
          size="sm"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {formatAddress(address)}
        </Button>
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-10 w-44 rounded-md border border-[var(--card-border)] bg-[var(--card)] shadow-lg p-1 text-xs"
          >
            <Link
              href="/profile"
              className="block w-full text-left px-2 py-1.5 rounded hover:bg-[var(--accent)]/10 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Profile
            </Link>
            <button
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--accent)]/10 transition-colors"
              onClick={handleCopy}
            >
              {copied ? 'Copied' : 'Copy address'}
            </button>
            <button
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--accent)]/10 transition-colors"
              onClick={async () => {
                setMenuOpen(false);
                await logout();
                login();
              }}
            >
              Switch account
            </button>
            <button
              className="w-full text-left px-2 py-1.5 rounded text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
              onClick={() => {
                setMenuOpen(false);
                softDisconnect();
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isAuthenticated && softDisconnected) {
    return (
      <Button
        size="sm"
        onClick={() => {
          resume();
        }}
      >
        Reconnect
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={login}>
      Connect
    </Button>
  );
}
