'use client';

/**
 * ClobAuthProvider — automatically derives CLOB L2 credentials on wallet connect.
 * Must be rendered inside PrivyProvider. Also renders the Toaster for toast notifications.
 */

import { useEffect, useRef } from 'react';
import { Toaster, toast } from '@app/ui';
import { useClobAuth } from '@/hooks/use-clob-auth';
import { usePrivyAvailable } from '@/providers/privy-provider';

function ClobAuthWatcher() {
  const { derivationError } = useClobAuth();
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (derivationError && derivationError !== lastErrorRef.current) {
      lastErrorRef.current = derivationError;
      toast({
        variant: 'error',
        title: 'Auth failed',
        description: derivationError,
      });
    } else if (!derivationError) {
      lastErrorRef.current = null;
    }
  }, [derivationError]);

  return null;
}

export function ClobAuthProvider({ children }: { children: React.ReactNode }) {
  const privyAvailable = usePrivyAvailable();

  return (
    <>
      {privyAvailable && <ClobAuthWatcher />}
      {children}
      <Toaster />
    </>
  );
}
