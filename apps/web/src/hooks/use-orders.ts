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
const CLOB_API_URL = '/api/clob';

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
      const res = await fetch(`${CLOB_API_URL}/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...l2Headers,
          ...builderHeaders,
        },
        body: bodyStr,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ errorMsg: 'Order submission failed' }));
        throw new Error(error.errorMsg || error.message || 'Failed to submit order');
      }

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.errorMsg || 'Order was not accepted');
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

      const res = await fetch(`${CLOB_API_URL}/order/${orderId}`, {
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
      const path = `/data/orders${qs ? `?${qs}` : ''}`;

      const l2Headers = await signClobRequest(
        credentials,
        address,
        'GET',
        path
      );

      const res = await fetch(`${CLOB_API_URL}${path}`, {
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
