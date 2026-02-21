'use client';

/**
 * Order placement, cancellation, and open orders hooks
 * Full L2 + builder HMAC authentication
 */

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSignTypedData, useWallets } from '@privy-io/react-auth';
import {
  type OrderParams,
  type MarketConstraints,
  type SignTypedDataFn,
  buildOrderStruct,
  validateOrderParams,
  calculateOrderEstimate,
  signOrder,
  buildOrderRequestBody,
  signClobRequest,
} from '@app/trading';
import { CHAIN_CONFIG } from '@app/config';
import { useWalletStore, useClobCredentialStore } from '@/stores';
import { usePublicClient } from 'wagmi';
import { createWalletClient, custom, erc20Abi, formatUnits } from 'viem';
import { polygon } from 'viem/chains';

const USDC_ADDRESS = CHAIN_CONFIG.polygon.usdc;
const CTF_ADDRESS = CHAIN_CONFIG.polygon.ctf;

// ERC-1155 balanceOf ABI fragment
const CTF_BALANCE_OF_ABI = [
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// CLOB requests go direct from the browser so the user's IP is used (geo-restriction).
// Datacenter/server IPs are blocked by Polymarket, so proxy won't work for trading.
// Fallback to proxy only for GET requests that hit CORS issues.
const DIRECT_CLOB_URL = 'https://clob.polymarket.com';
const PROXY_CLOB_URL = '/api/clob';

async function fetchClob(path: string, init: RequestInit) {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method === 'GET') {
    try {
      return await fetch(`${DIRECT_CLOB_URL}${path}`, init);
    } catch {
      return await fetch(`${PROXY_CLOB_URL}${path}`, init);
    }
  }
  // POST/DELETE: direct only — user's IP must be used for geo-compliance
  return await fetch(`${DIRECT_CLOB_URL}${path}`, init);
}

interface UseOrderOptions {
  onSuccess?: (orderId: string) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: string) => void;
}

/**
 * Hook for placing orders with full L2 + builder authentication
 */
export function usePlaceOrder(options?: UseOrderOptions) {
  const { signTypedData: privySignTypedData } = useSignTypedData();
  const { wallets } = useWallets();
  const publicClient = usePublicClient();
  const { address } = useWalletStore();
  const { credentials } = useClobCredentialStore();
  const queryClient = useQueryClient();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  return useMutation({
    mutationFn: async (params: OrderParams & { constraints?: MarketConstraints }) => {
      // 1. Validate params
      const { constraints, ...orderParams } = params;
      const validation = validateOrderParams(orderParams, constraints);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // 2. Check wallet + credentials
      if (!address) {
        throw new Error('Please connect your wallet to place orders');
      }
      if (!credentials) {
        throw new Error('CLOB credentials not available. Please reconnect your wallet.');
      }

      // 3. Build order struct (nonce = "0" for EOA)
      const orderStruct = buildOrderStruct(params, address, '0');

      // 4. Sign Order EIP-712 (silent for embedded wallets, popup for external)
      options?.onStatusChange?.('Awaiting signature...');

      const wallet = wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());
      if (!wallet) throw new Error('Wallet not found. Please reconnect.');

      const signTypedDataFn: SignTypedDataFn = async (p) => {
        if (wallet.walletClientType === 'privy') {
          // Embedded wallet — silent signing via Privy
          const mutableTypes = { Order: [...p.types.Order] };
          return await privySignTypedData({
            domain: p.domain,
            types: mutableTypes,
            primaryType: p.primaryType,
            message: p.message,
          }, undefined, p.account);
        } else {
          // External wallet — sign via provider
          const provider = await wallet.getEthereumProvider();
          const wc = createWalletClient({
            account: p.account as `0x${string}`,
            chain: polygon,
            transport: custom(provider),
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return await wc.signTypedData({
            domain: p.domain,
            types: { Order: [...p.types.Order] },
            primaryType: 'Order',
            message: p.message,
          } as any);
        }
      };

      const signedOrder = await signOrder(orderStruct, address, signTypedDataFn, params.negRisk);

      // 5. Build POST body
      options?.onStatusChange?.('Submitting order...');
      const body = buildOrderRequestBody(signedOrder, credentials.apiKey, params.orderType ?? 'GTC');
      const bodyStr = JSON.stringify(body);

      // 6. Generate L2 HMAC headers
      const l2Headers = await signClobRequest(
        credentials,
        address,
        'POST',
        '/order',
        bodyStr
      );

      // 7. Fetch builder headers from /api/polymarket/sign
      const builderRes = await fetch('/api/polymarket/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'POST', path: '/order', body }),
      });
      if (!builderRes.ok) {
        throw new Error('Failed to get builder signature');
      }
      const builderHeaders = await builderRes.json();

      // 8. Merge L2 + builder headers and POST to CLOB
      const res = await fetchClob('/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...l2Headers,
          ...builderHeaders,
        },
        body: bodyStr,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let message = `Order submission failed (${res.status})`;
        if (text) {
          try {
            const parsed = JSON.parse(text);
            message = parsed.error || parsed.errorMsg || parsed.message || message;
          } catch {
            message = `${message}: ${text}`;
          }
        }
        if (res.status === 401 && message.toLowerCase().includes('api key')) {
          useClobCredentialStore.getState().clearCredentials();
        }
        throw new Error(message);
      }

      const result = await res.json().catch(() => ({}));
      if (!result.success) {
        throw new Error(result.error || result.errorMsg || result.message || 'Order was not accepted');
      }

      options?.onStatusChange?.('Order placed!');
      return result.orderID || result.orderId;
    },
    onSuccess: (orderId, params) => {
      // Immediate: invalidate open orders list, balance/allowance, and positions
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });

      if (address) {
        // Immediately invalidate balance so TanStack Query refetches
        // (the polling below will correct with on-chain data once settled)
        queryClient.invalidateQueries({ queryKey: ['usdc-balance', address] });

        // 1. Optimistic UI update — show expected balance instantly
        const currentUsdc = useWalletStore.getState().usdcBalance;
        const orderCost = (params.price / 100) * params.size;
        const optimisticUsdc = params.side === 'BUY'
          ? currentUsdc - orderCost
          : currentUsdc + orderCost;
        useWalletStore.getState().setBalance(Math.max(0, optimisticUsdc));

        // 2. Poll on-chain every 2s to verify/correct with real balances.
        //    Stops when balance changes from pre-order value or after 30s.
        const preOrderUsdc = currentUsdc;
        let pollCount = 0;
        const maxPolls = 15; // 15 × 2s = 30s max

        // Clear any previous poll (e.g. rapid successive orders)
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }

        pollIntervalRef.current = setInterval(async () => {
          pollCount++;
          try {
            if (!publicClient) return;
            const client = publicClient;
            const [usdcBal] = await Promise.all([
              client.readContract({
                address: USDC_ADDRESS,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address as `0x${string}`],
              }),
              client.readContract({
                address: CTF_ADDRESS,
                abi: CTF_BALANCE_OF_ABI,
                functionName: 'balanceOf',
                args: [address as `0x${string}`, BigInt(params.tokenId)],
              }),
            ]);

            const realUsdc = Number(formatUnits(usdcBal, 6));
            const settled = Math.abs(realUsdc - preOrderUsdc) > 0.001;

            if (settled || pollCount >= maxPolls) {
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;

              // Write real on-chain balance — corrects any optimistic drift
              useWalletStore.getState().setBalance(realUsdc);
              queryClient.invalidateQueries({ queryKey: ['usdc-balance', address] });
              queryClient.invalidateQueries({ queryKey: ['ctf-balance', address, params.tokenId] });

              // Background: Data API positions (avg price, P&L)
              queryClient.invalidateQueries({ queryKey: ['positions'] });
            }
          } catch {
            // Network error — keep polling, don't stop early
            if (pollCount >= maxPolls) {
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;
              queryClient.invalidateQueries({ queryKey: ['usdc-balance', address] });
              queryClient.invalidateQueries({ queryKey: ['ctf-balance'] });
              queryClient.invalidateQueries({ queryKey: ['positions'] });
            }
          }
        }, 2_000);
      }

      options?.onSuccess?.(orderId);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}

/**
 * Hook for order validation and estimation
 */
export function useOrderEstimate(params: Partial<OrderParams>) {
  if (!params.tokenId || !params.price || !params.size || !params.side) {
    return null;
  }

  const validation = validateOrderParams(params as OrderParams);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, estimate: null };
  }

  const estimate = calculateOrderEstimate(params as OrderParams);
  return { valid: true, errors: [], estimate };
}

/**
 * Hook for cancelling orders with L2 authentication
 */
export function useCancelOrder(options?: UseOrderOptions) {
  const { address } = useWalletStore();
  const { credentials } = useClobCredentialStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!address) {
        throw new Error('Please connect your wallet');
      }
      if (!credentials) {
        throw new Error('CLOB credentials not available');
      }

      // L2 headers for DELETE /order with body
      const cancelBody = JSON.stringify({ orderID: orderId });
      const l2Headers = await signClobRequest(
        credentials,
        address,
        'DELETE',
        '/order',
        cancelBody
      );

      const res = await fetchClob('/order', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...l2Headers,
        },
        body: cancelBody,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to cancel order' }));
        throw new Error(error.message || 'Failed to cancel order');
      }

      const result = await res.json().catch(() => ({}));
      const notCanceled = result.not_canceled ?? {};
      if (Object.keys(notCanceled).length > 0) {
        throw new Error(notCanceled[orderId] || 'Order could not be cancelled');
      }

      return orderId;
    },
    onSuccess: (orderId) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      // Cancelling an order may unfreeze collateral — refresh balance
      const addr = useWalletStore.getState().address;
      if (addr) {
        queryClient.invalidateQueries({ queryKey: ['usdc-balance', addr] });
      }
      options?.onSuccess?.(orderId);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}

/**
 * Hook for getting user's open orders with L2 authentication
 */
export function useOpenOrders(params?: { market?: string; assetId?: string }) {
  const { address } = useWalletStore();
  const { credentials } = useClobCredentialStore();

  return useQuery({
    queryKey: ['orders', address, params?.market, params?.assetId],
    queryFn: async () => {
      if (!address || !credentials) return [];

      const searchParams = new URLSearchParams();
      if (params?.market) searchParams.set('market', params.market);
      if (params?.assetId) searchParams.set('asset_id', params.assetId);
      const qs = searchParams.toString();
      const signPath = '/data/orders';
      const requestUrl = `${signPath}${qs ? `?${qs}` : ''}`;

      // L2 HMAC signs path only (no query params) — per official Polymarket CLOB clients
      const l2Headers = await signClobRequest(
        credentials,
        address,
        'GET',
        signPath
      );

      const res = await fetchClob(requestUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...l2Headers,
        },
      });

      if (!res.ok) return [];
      const data = await res.json();
      // CLOB may return bare array or {data: [...]} wrapper
      return Array.isArray(data) ? data : (data?.data ?? []);
    },
    enabled: !!address && !!credentials,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}
