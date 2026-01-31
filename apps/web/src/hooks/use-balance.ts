'use client';

/**
 * Hook for fetching USDC balance and allowance from CLOB API.
 * Uses GET /balance-allowance?signature_type=0 with L2 auth headers.
 * Updates wallet-store.usdcBalance and provides allowance info.
 * Falls back to on-chain balance when CLOB auth is unavailable or fails.
 */

import { useQuery } from '@tanstack/react-query';
import { signClobRequest } from '@app/trading';
import { CHAIN_CONFIG } from '@app/config';
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';
import { useClobCredentialStore, useWalletStore } from '@/stores';
import { useEffect } from 'react';

// Route through our proxy to avoid CORS issues with custom POLY_* headers
const CLOB_API_URL = '/api/clob';
const USDC_ADDRESS = CHAIN_CONFIG.polygon.usdc;
const CTF_EXCHANGE = CHAIN_CONFIG.polygon.ctfExchange;
const POLYGON_RPC_URL = CHAIN_CONFIG.polygon.rpcUrl;

let publicClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      transport: http(POLYGON_RPC_URL),
    });
  }
  return publicClient;
}

interface BalanceAllowance {
  balance: number;       // USDC balance (human-readable, 6 decimals converted)
  allowance: number;     // Token allowance for CTF Exchange
  rawBalance: string;    // Raw balance string from API
  rawAllowance: string;  // Raw allowance string from API
  walletBalance?: number; // On-chain USDC balance (fallback/display)
  onChainAllowance?: number; // On-chain allowance for CTF Exchange (fallback/display)
  balanceSource: 'clob' | 'onchain';
}

async function fetchOnChainBalance(address: string): Promise<number> {
  const client = getPublicClient();
  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });
  return Number(formatUnits(balance, 6));
}

async function fetchOnChainAllowance(address: string): Promise<number> {
  const client = getPublicClient();
  const allowance = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address as `0x${string}`, CTF_EXCHANGE],
  });
  return Number(formatUnits(allowance, 6));
}

async function fetchBalanceAllowance(
  address: string,
  credentials: { apiKey: string; secret: string; passphrase: string } | null
): Promise<BalanceAllowance> {
  if (!credentials) {
    const [walletBalance, onChainAllowance] = await Promise.all([
      fetchOnChainBalance(address),
      fetchOnChainAllowance(address),
    ]);
    return {
      balance: walletBalance,
      allowance: 0,
      rawBalance: '0',
      rawAllowance: '0',
      walletBalance,
      onChainAllowance,
      balanceSource: 'onchain',
    };
  }
  const path = '/balance-allowance';
  const params = '?signature_type=0';
  const fullPath = `${path}${params}`;

  const headers = await signClobRequest(credentials, address, 'GET', fullPath);

  try {
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
    const balance = parseFloat(data.balance ?? '0') / 1e6;

    let walletBalance: number | undefined;
    let onChainAllowance: number | undefined;
    if (balance === 0) {
      try {
        const results = await Promise.all([
          fetchOnChainBalance(address),
          fetchOnChainAllowance(address),
        ]);
        walletBalance = results[0];
        onChainAllowance = results[1];
      } catch {
        walletBalance = undefined;
        onChainAllowance = undefined;
      }
    }

    return {
      balance,
      allowance: parseFloat(data.allowance ?? '0') / 1e6,
      rawBalance: data.balance ?? '0',
      rawAllowance: data.allowance ?? '0',
      walletBalance,
      onChainAllowance,
      balanceSource: 'clob',
    };
  } catch (err) {
    const [walletBalance, onChainAllowance] = await Promise.all([
      fetchOnChainBalance(address),
      fetchOnChainAllowance(address),
    ]);
    return {
      balance: walletBalance,
      allowance: 0,
      rawBalance: '0',
      rawAllowance: '0',
      walletBalance,
      onChainAllowance,
      balanceSource: 'onchain',
    };
  }
}

/**
 * Fetches USDC balance and allowance from CLOB API.
 * - Enabled when address exists; falls back to on-chain balance/allowance
 * - 30s refetch interval
 * - Updates wallet-store.usdcBalance on success
 */
export function useUsdcBalance() {
  const { address, isConnected } = useWalletStore();
  const { credentials } = useClobCredentialStore();

  const query = useQuery({
    queryKey: ['usdc-balance', address],
    queryFn: () => fetchBalanceAllowance(address!, credentials),
    enabled: !!address && isConnected,
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
    walletBalance: query.data?.walletBalance,
    onChainAllowance: query.data?.onChainAllowance,
    balanceSource: query.data?.balanceSource ?? 'clob',
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
