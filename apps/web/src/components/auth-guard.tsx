'use client';

import type { ReactNode } from 'react';
import { usePrivyAvailable } from '@/providers/privy-provider';
import { useAuth } from '@/hooks/use-auth';
import { useWalletStore } from '@/stores';
import { ConnectButton } from '@/components/connect-button';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  requireWallet?: boolean;
  title?: string;
  description?: string;
}

export function AuthGuard({
  children,
  fallback,
  loadingFallback,
  requireWallet = true,
  title = 'Connect your wallet',
  description = 'Connect your wallet to continue.',
}: AuthGuardProps) {
  const privyAvailable = usePrivyAvailable();

  if (!privyAvailable) {
    return fallback ?? (
      <AuthGuardFallback title="HTTPS required" description="Wallet connection requires a secure origin." />
    );
  }

  return (
    <AuthGuardInner
      fallback={fallback}
      loadingFallback={loadingFallback}
      requireWallet={requireWallet}
      title={title}
      description={description}
    >
      {children}
    </AuthGuardInner>
  );
}

function AuthGuardInner({
  children,
  fallback,
  loadingFallback,
  requireWallet,
  title,
  description,
}: Required<Pick<AuthGuardProps, 'children' | 'requireWallet' | 'title' | 'description'>> &
  Pick<AuthGuardProps, 'fallback' | 'loadingFallback'>) {
  const { isReady } = useAuth();
  const isConnected = useWalletStore((state) => state.isConnected);

  if (!isReady) {
    return (
      loadingFallback ?? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Loading wallet...</p>
        </div>
      )
    );
  }

  if (requireWallet && !isConnected) {
    return fallback ?? <AuthGuardFallback title={title} description={description} />;
  }

  return <>{children}</>;
}

function AuthGuardFallback({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-12">
      <div className="text-center max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-3">{title}</h1>
        <p className="text-muted-foreground mb-6">{description}</p>
        <ConnectButton />
      </div>
    </div>
  );
}
