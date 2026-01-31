'use client';

/**
 * Hook for fetching USDC balance and allowance from CLOB API.
 * Uses GET /balance-allowance?signature_type=0 with L2 auth headers.
 * Updates wallet-store.usdcBalance and provides allowance info.
 */

import { useQuery } from '@tanstack/react-query';
import { signClobRequest } from '@app/trading';
import { useClobCredentialStore, useWalletStore } from '@/stores';
import { useEffect } from 'react';

const CLOB_API_URL = 'https://clob.polymarket.com';

interface BalanceAllowance {
  balance: number;       // USDC balance (human-readable, 6 decimals converted)
  allowance: number;     // Token allowance for CTF Exchange
  rawBalance: string;    // Raw balance string from API
  rawAllowance: string;  // Raw allowance string from API
}

async function fetchBalanceAllowance(
  address: string,
  credentials: { apiKey: string; secret: string; passphrase: string }
): Promise<BalanceAllowance> {
  const path = '/balance-allowance';
  const params = '?signature_type=0';
  const fullPath = `${path}${params}`;

  const headers = await signClobRequest(credentials, address, 'GET', fullPath);

  const res = await fetch(`${CLOB_API_URL}${fullPath}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Balance fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  return {
    balance: parseFloat(data.balance ?? '0') / 1e6,
    allowance: parseFloat(data.allowance ?? '0') / 1e6,
    rawBalance: data.balance ?? '0',
    rawAllowance: data.allowance ?? '0',
  };
}

/**
 * Fetches USDC balance and allowance from CLOB API.
 * - Enabled only when address + L2 credentials exist
 * - 30s refetch interval
 * - Updates wallet-store.usdcBalance on success
 */
export function useUsdcBalance() {
  const { address, isConnected } = useWalletStore();
  const { credentials } = useClobCredentialStore();

  const query = useQuery({
    queryKey: ['usdc-balance', address],
    queryFn: () => fetchBalanceAllowance(address!, credentials!),
    enabled: !!address && !!credentials && isConnected,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  // Sync balance to wallet store
  useEffect(() => {
    if (query.data) {
      useWalletStore.getState().setBalance(query.data.balance);
    }
  }, [query.data]);

  return {
    balance: query.data?.balance ?? 0,
    allowance: query.data?.allowance ?? 0,
    rawBalance: query.data?.rawBalance ?? '0',
    rawAllowance: query.data?.rawAllowance ?? '0',
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
