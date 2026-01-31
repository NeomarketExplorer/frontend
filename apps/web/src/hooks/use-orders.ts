/**
 * Order placement hooks
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import {
  type OrderParams,
  buildOrderStruct,
  createOrderTypedData,
  validateOrderParams,
  calculateOrderEstimate,
} from '@app/trading';
import { useWalletStore } from '@/stores';

// Polygon chain ID
const CHAIN_ID = 137;

// CTF Exchange address on Polygon
const CTF_EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

// CLOB API for order submission
const CLOB_API_URL = 'https://clob.polymarket.com';

interface UseOrderOptions {
  onSuccess?: (orderId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for placing orders
 */
export function usePlaceOrder(options?: UseOrderOptions) {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { address } = useWalletStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: OrderParams) => {
      // Validate params
      const validation = validateOrderParams(params);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Check wallet connection
      if (!authenticated || !address) {
        throw new Error('Please connect your wallet to place orders');
      }

      const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Get nonce from CLOB API
      const nonceRes = await fetch(`${CLOB_API_URL}/auth/nonce`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!nonceRes.ok) {
        throw new Error('Failed to get nonce');
      }
      const { nonce } = await nonceRes.json();

      // Build order struct
      const orderStruct = buildOrderStruct(params, address, nonce);

      // Create typed data for signing
      const typedData = createOrderTypedData(orderStruct, CHAIN_ID, CTF_EXCHANGE_ADDRESS);

      // Get provider and sign
      const provider = await wallet.getEthereumProvider();

      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [
          address,
          JSON.stringify({
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
              ],
              ...typedData.types,
            },
            primaryType: 'Order',
            domain: typedData.domain,
            message: Object.fromEntries(
              Object.entries(typedData.message).map(([k, v]) => [
                k,
                typeof v === 'bigint' ? v.toString() : v,
              ])
            ),
          }),
        ],
      }) as string;

      // Submit order to CLOB
      const signedOrder = {
        ...orderStruct,
        signature,
      };

      const submitRes = await fetch(`${CLOB_API_URL}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedOrder),
      });

      if (!submitRes.ok) {
        const error = await submitRes.json();
        throw new Error(error.message || 'Failed to submit order');
      }

      const result = await submitRes.json();
      return result.orderID || result.orderId;
    },
    onSuccess: (orderId) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
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
 * Hook for cancelling orders
 */
export function useCancelOrder(options?: UseOrderOptions) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address } = useWalletStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!authenticated || !address) {
        throw new Error('Please connect your wallet');
      }

      const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Cancel order via CLOB API
      const res = await fetch(`${CLOB_API_URL}/order/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers as needed
        },
      });

      if (!res.ok) {
        const error = await res.json();
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
 * Hook for getting user's open orders
 */
export function useOpenOrders() {
  const { address } = useWalletStore();

  // This would need to be implemented with the CLOB API
  // For now, return empty array
  return {
    data: [] as Array<{
      id: string;
      tokenId: string;
      side: 'BUY' | 'SELL';
      price: number;
      size: number;
      filledSize: number;
      status: 'open' | 'partial' | 'filled' | 'cancelled';
      createdAt: string;
    }>,
    isLoading: false,
  };
}
