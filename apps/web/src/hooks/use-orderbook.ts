/**
 * TanStack Query hooks for orderbook data
 */

import { useQuery } from '@tanstack/react-query';
import { createClobClient } from '@app/api';

const clobClient = createClobClient({ baseUrl: '/api/clob' });

// Query keys
export const orderbookKeys = {
  all: ['orderbook'] as const,
  token: (tokenId: string) => [...orderbookKeys.all, tokenId] as const,
  midpoint: (tokenId: string) => [...orderbookKeys.all, 'midpoint', tokenId] as const,
  spread: (tokenId: string) => [...orderbookKeys.all, 'spread', tokenId] as const,
  trades: (tokenId: string) => [...orderbookKeys.all, 'trades', tokenId] as const,
  priceHistory: (market: string, interval: string) =>
    [...orderbookKeys.all, 'history', market, interval] as const,
};

/**
 * Fetch orderbook for a token
 */
export function useOrderbook(tokenId: string | null) {
  return useQuery({
    queryKey: orderbookKeys.token(tokenId ?? ''),
    queryFn: async () => {
      if (!tokenId) return null;
      try {
        const orderbook = await clobClient.getOrderbook(tokenId);
        return clobClient.parseOrderbook(orderbook);
      } catch {
        // CLOB returns error for closed/disabled orderbooks — treat as empty
        return { bids: [], asks: [] };
      }
    },
    enabled: !!tokenId,
    // Orderbook data is highly real-time, short stale time
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });
}

/**
 * Fetch midpoint price for a token
 */
export function useMidpoint(tokenId: string | null) {
  return useQuery({
    queryKey: orderbookKeys.midpoint(tokenId ?? ''),
    queryFn: async () => {
      if (!tokenId) return null;
      try {
        return await clobClient.getMidpoint(tokenId);
      } catch {
        // CLOB returns error for closed/disabled orderbooks
        return null;
      }
    },
    enabled: !!tokenId,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });
}

/**
 * Fetch spread for a token
 */
export function useSpread(tokenId: string | null) {
  return useQuery({
    queryKey: orderbookKeys.spread(tokenId ?? ''),
    queryFn: () => (tokenId ? clobClient.getSpread(tokenId) : null),
    enabled: !!tokenId,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });
}

/**
 * Fetch recent trades for a token.
 * Note: CLOB /trades now requires L2 auth — returns [] on failure.
 */
export function useTrades(tokenId: string | null, limit = 50) {
  return useQuery({
    queryKey: [...orderbookKeys.trades(tokenId ?? ''), limit],
    queryFn: async () => {
      if (!tokenId) return [];
      try {
        return await clobClient.getTrades(tokenId, limit);
      } catch {
        return [];
      }
    },
    enabled: !!tokenId,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Fetch price history for a market
 */
export function usePriceHistory(
  market: string | null,
  interval: '1h' | '6h' | '1d' | '1w' | 'max' = '1w'
) {
  return useQuery({
    queryKey: orderbookKeys.priceHistory(market ?? '', interval),
    queryFn: () => (market ? clobClient.getPriceHistory(market, interval) : []),
    enabled: !!market,
    staleTime: 60 * 1000,
  });
}
