/**
 * TanStack Query hooks for positions and portfolio data
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createDataClient, type Position } from '@app/api';
import { useWalletStore } from '@/stores/wallet-store';

const dataClient = createDataClient();

// Query keys
export const positionKeys = {
  all: ['positions'] as const,
  user: (address: string) => [...positionKeys.all, address] as const,
  activity: (address: string) => [...positionKeys.all, 'activity', address] as const,
  portfolio: (address: string) => [...positionKeys.all, 'portfolio', address] as const,
};

/**
 * Fetch user positions
 */
export function usePositions() {
  const address = useWalletStore((state) => state.address);

  return useQuery({
    queryKey: positionKeys.user(address ?? ''),
    queryFn: () => (address ? dataClient.getOpenPositions(address) : []),
    enabled: !!address,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Fetch user activity/trade history
 */
export function useActivity(limit = 50) {
  const address = useWalletStore((state) => state.address);

  return useQuery({
    queryKey: [...positionKeys.activity(address ?? ''), limit],
    queryFn: () => (address ? dataClient.getActivity(address, { limit }) : []),
    enabled: !!address,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch portfolio summary
 */
export function usePortfolio() {
  const address = useWalletStore((state) => state.address);

  return useQuery({
    queryKey: positionKeys.portfolio(address ?? ''),
    queryFn: () => (address ? dataClient.getPortfolioValue(address) : null),
    enabled: !!address,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Get positions grouped by market
 */
export function usePositionsByMarket() {
  const { data: positions, ...rest } = usePositions();

  const groupedPositions = positions?.reduce(
    (acc, position) => {
      const marketId = position.condition_id;
      if (!acc[marketId]) {
        acc[marketId] = [];
      }
      acc[marketId].push(position);
      return acc;
    },
    {} as Record<string, Position[]>
  );

  return {
    data: groupedPositions,
    positions,
    ...rest,
  };
}

/**
 * Get user's positions for a specific market (condition)
 * Filters all positions by condition_id. Returns empty array if no position.
 */
export function useMarketPositions(conditionId: string | null) {
  const { data: positions, ...rest } = usePositions();

  const marketPositions = useMemo(() => {
    if (!positions || !conditionId) return [];
    return positions.filter(
      (p) => p.condition_id.toLowerCase() === conditionId.toLowerCase()
    );
  }, [positions, conditionId]);

  return {
    data: marketPositions,
    ...rest,
  };
}
