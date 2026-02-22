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
import { erc20Abi, formatUnits, type PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { useClobCredentialStore, useWalletStore } from '@/stores';
import { useEffect } from 'react';

// CLOB requests go direct from the browser so the user's IP is used (geo-restriction).
// Polymarket blocks datacenter IPs, so proxy won't work for auth/trading.
const DIRECT_CLOB_URL = 'https://clob.polymarket.com';
const PROXY_CLOB_URL = '/api/clob';
const USDC_ADDRESS = CHAIN_CONFIG.polygon.usdc;
const CTF_EXCHANGE = CHAIN_CONFIG.polygon.ctfExchange;
const NEG_RISK_CTF_EXCHANGE = CHAIN_CONFIG.polygon.negRiskCtfExchange;
const NEG_RISK_ADAPTER = CHAIN_CONFIG.polygon.negRiskAdapter;

interface BalanceAllowance {
  balance: number;       // USDC balance (human-readable, 6 decimals converted)
  ctfAllowance: number;  // Allowance for regular CTF Exchange
  negRiskAllowance: number; // Allowance for Neg Risk CTF Exchange
  negRiskAdapterAllowance: number; // Allowance for Neg Risk Adapter
  rawBalance: string;    // Raw balance string from API
  walletBalance?: number; // On-chain USDC balance (fallback/display)
  onChainAllowance?: number; // On-chain allowance for CTF Exchange (fallback/display)
  balanceSource: 'clob' | 'onchain';
}

async function fetchOnChainBalance(address: string, client: PublicClient): Promise<number> {
  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });
  return Number(formatUnits(balance, 6));
}

interface OnChainAllowances {
  ctfAllowance: number;
  negRiskAllowance: number;
  negRiskAdapterAllowance: number;
}

async function fetchOnChainAllowances(address: string, client: PublicClient): Promise<OnChainAllowances> {
  const spenders = [CTF_EXCHANGE, NEG_RISK_CTF_EXCHANGE, NEG_RISK_ADAPTER] as const;
  const results = await Promise.all(
    spenders.map((spender) =>
      client.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address as `0x${string}`, spender as `0x${string}`],
      })
    )
  );
  return {
    ctfAllowance: Number(formatUnits(results[0], 6)),
    negRiskAllowance: Number(formatUnits(results[1], 6)),
    negRiskAdapterAllowance: Number(formatUnits(results[2], 6)),
  };
}

async function fetchBalanceAllowance(
  address: string,
  credentials: { apiKey: string; secret: string; passphrase: string } | null,
  client: PublicClient
): Promise<BalanceAllowance> {
  if (!credentials) {
    const [walletBalance, allowances] = await Promise.all([
      fetchOnChainBalance(address, client),
      fetchOnChainAllowances(address, client),
    ]);
    return {
      balance: walletBalance,
      ctfAllowance: allowances.ctfAllowance,
      negRiskAllowance: allowances.negRiskAllowance,
      negRiskAdapterAllowance: allowances.negRiskAdapterAllowance,
      rawBalance: '0',
      walletBalance,
      onChainAllowance: allowances.ctfAllowance,
      balanceSource: 'onchain',
    };
  }
  // L2 HMAC signs path only (no query params) — confirmed from official Polymarket CLOB clients
  const signPath = '/balance-allowance';
  const requestUrl = '/balance-allowance?asset_type=COLLATERAL&signature_type=0';

  try {
    const headers = await signClobRequest(credentials, address, 'GET', signPath);
    let res: Response;
    try {
      res = await fetch(`${DIRECT_CLOB_URL}${requestUrl}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
    } catch {
      res = await fetch(`${PROXY_CLOB_URL}${requestUrl}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401) {
        useClobCredentialStore.getState().clearCredentials();
      }
      throw new Error(`Balance fetch failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const balance = parseFloat(data.balance ?? '0') / 1e6;

    // CLOB returns allowances as { "0xAddress": "rawAmount", ... }
    // Normalize keys to lowercase — CLOB may return checksummed addresses
    const rawAllowances = data.allowances ?? {};
    const allowances: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawAllowances)) {
      allowances[key.toLowerCase()] = val as string;
    }
    let ctfAllowance = parseFloat(allowances[CTF_EXCHANGE.toLowerCase()] ?? '0') / 1e6;
    let negRiskAllowance = parseFloat(allowances[NEG_RISK_CTF_EXCHANGE.toLowerCase()] ?? '0') / 1e6;
    let negRiskAdapterAllowance = parseFloat(allowances[NEG_RISK_ADAPTER.toLowerCase()] ?? '0') / 1e6;

    let walletBalance: number | undefined;
    let onChainAllowance: number | undefined;
    // Fall back to on-chain reads when CLOB returns zero balance OR zero allowances.
    // CLOB caches internally — fresh on-chain approvals may not reflect immediately.
    if (balance === 0 || ctfAllowance === 0) {
      try {
        const [onChainBal, onChainAllow] = await Promise.all([
          fetchOnChainBalance(address, client),
          fetchOnChainAllowances(address, client),
        ]);
        walletBalance = onChainBal;
        onChainAllowance = onChainAllow.ctfAllowance;
        // Use the higher of CLOB vs on-chain allowance (CLOB may be stale)
        if (onChainAllow.ctfAllowance > ctfAllowance) {
          ctfAllowance = onChainAllow.ctfAllowance;
        }
        if (onChainAllow.negRiskAllowance > negRiskAllowance) {
          negRiskAllowance = onChainAllow.negRiskAllowance;
        }
        if (onChainAllow.negRiskAdapterAllowance > negRiskAdapterAllowance) {
          negRiskAdapterAllowance = onChainAllow.negRiskAdapterAllowance;
        }
      } catch {
        walletBalance = undefined;
        onChainAllowance = undefined;
      }
    }

    return {
      balance,
      ctfAllowance,
      negRiskAllowance,
      negRiskAdapterAllowance,
      rawBalance: data.balance ?? '0',
      walletBalance,
      onChainAllowance,
      balanceSource: 'clob',
    };
  } catch {
    const [walletBalance, allowances] = await Promise.all([
      fetchOnChainBalance(address, client),
      fetchOnChainAllowances(address, client),
    ]);
    return {
      balance: walletBalance,
      ctfAllowance: allowances.ctfAllowance,
      negRiskAllowance: allowances.negRiskAllowance,
      negRiskAdapterAllowance: allowances.negRiskAdapterAllowance,
      rawBalance: '0',
      walletBalance,
      onChainAllowance: allowances.ctfAllowance,
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
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ['usdc-balance', address],
    queryFn: () => fetchBalanceAllowance(address!, credentials, publicClient!),
    enabled: !!address && isConnected && !!publicClient,
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
    ctfAllowance: query.data?.ctfAllowance ?? 0,
    negRiskAllowance: query.data?.negRiskAllowance ?? 0,
    negRiskAdapterAllowance: query.data?.negRiskAdapterAllowance ?? 0,
    rawBalance: query.data?.rawBalance ?? '0',
    walletBalance: query.data?.walletBalance,
    onChainAllowance: query.data?.onChainAllowance,
    balanceSource: query.data?.balanceSource ?? 'clob',
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
