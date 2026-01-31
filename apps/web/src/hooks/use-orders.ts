'use client';

/**
 * Order placement, cancellation, and open orders hooks
 * Full L2 + builder HMAC authentication
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallets } from '@privy-io/react-auth';
import {
  type OrderParams,
  type SignedOrder,
  buildOrderStruct,
  validateOrderParams,
  calculateOrderEstimate,
  signOrder,
  buildOrderRequestBody,
  signClobRequest,
  ORDER_TYPES,
} from '@app/trading';
import { CTF_EXCHANGE_DOMAIN } from '@app/config';
import { useWalletStore, useClobCredentialStore } from '@/stores';

// Route through our proxy to avoid CORS issues with custom POLY_* headers
const DIRECT_CLOB_API_URL = 'https://clob.polymarket.com';
const PROXY_CLOB_API_URL = '/api/clob';

async function fetchClob(path: string, init: RequestInit) {
  // Prefer direct CLOB (avoids Cloudflare blocks on server IP). Fallback to proxy on CORS/network errors.
  try {
    return await fetch(`${DIRECT_CLOB_API_URL}${path}`, init);
  } catch {
    return await fetch(`${PROXY_CLOB_API_URL}${path}`, init);
  }
}

interface UseOrderOptions {
  onSuccess?: (orderId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for placing orders with full L2 + builder authentication
 */
export function usePlaceOrder(options?: UseOrderOptions) {
  const { wallets } = useWallets();
  const { address } = useWalletStore();
  const { credentials } = useClobCredentialStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: OrderParams) => {
      // 1. Validate params
      const validation = validateOrderParams(params);
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

      const wallet = wallets.find(
        (w) => w.address.toLowerCase() === address.toLowerCase()
      );
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // 3. Build order struct (nonce = "0" for EOA)
      const orderStruct = buildOrderStruct(params, address, '0');

      // 4. Sign Order EIP-712 via wallet provider
      const provider = await wallet.getEthereumProvider();

      const signTypedDataFn = async (p: {
        account: string;
        domain: typeof CTF_EXCHANGE_DOMAIN;
        types: typeof ORDER_TYPES;
        primaryType: 'Order';
        message: Record<string, unknown>;
      }) => {
        const sig = await provider.request({
          method: 'eth_signTypedData_v4',
          params: [
            p.account,
            JSON.stringify({
              types: {
                EIP712Domain: [
                  { name: 'name', type: 'string' },
                  { name: 'version', type: 'string' },
                  { name: 'chainId', type: 'uint256' },
                  { name: 'verifyingContract', type: 'address' },
                ],
                ...p.types,
              },
              primaryType: p.primaryType,
              domain: p.domain,
              message: p.message,
            }),
          ],
        });
        return sig as string;
      };

      const signedOrder = await signOrder(orderStruct, address, signTypedDataFn);

      // 5. Build POST body
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
            message = parsed.errorMsg || parsed.message || message;
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
        throw new Error(result.errorMsg || result.message || 'Order was not accepted');
      }

      return result.orderID || result.orderId;
    },
    onSuccess: (orderId) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      if (address) {
        queryClient.invalidateQueries({ queryKey: ['usdc-balance', address] });
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

      // L2 headers for DELETE /order/{id}
      const l2Headers = await signClobRequest(
        credentials,
        address,
        'DELETE',
        `/order/${orderId}`
      );

      const res = await fetchClob(`/order/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...l2Headers,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to cancel order' }));
        throw new Error(error.message || 'Failed to cancel order');
      }

      return orderId;
    },
    onSuccess: (orderId) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
      return res.json();
    },
    enabled: !!address && !!credentials,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}
