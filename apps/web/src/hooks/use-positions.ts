/**
 * TanStack Query hooks for positions and portfolio data.
 * Fetches from Polymarket Data API via /api/data proxy,
 * then enriches positions with market names from Gamma API.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createDataClient, type Position } from '@app/api';
import { useWalletStore } from '@/stores/wallet-store';

// Route through proxy to avoid CORS
const dataClient = createDataClient({ baseUrl: '/api/data' });

// Query keys
export const positionKeys = {
  all: ['positions'] as const,
  user: (address: string) => [...positionKeys.all, address] as const,
  activity: (address: string) => [...positionKeys.all, 'activity', address] as const,
  portfolio: (address: string) => [...positionKeys.all, 'portfolio', address] as const,
};

export interface EnrichedPosition extends Position {
  marketQuestion: string | null;
  marketId: string | null;
  marketSlug: string | null;
  outcomeName: string;
}

/**
 * Resolve market names for a set of positions by querying Gamma API.
 * Groups by condition_id, batch-fetches, returns lookup map.
 */
async function enrichPositionsWithMarketData(
  positions: Position[]
): Promise<EnrichedPosition[]> {
  if (positions.length === 0) return [];

  const conditionIds = [...new Set(positions.map((p) => p.condition_id))];

  // Gamma API supports condition_ids param for batch lookup
  // Fetch through our proxy to avoid CORS
  const marketMap: Record<string, { question: string; id: string; slug: string; outcomes: string[] }> = {};
  try {
    const res = await fetch(
      `/api/gamma/markets?condition_ids=${conditionIds.join(',')}&limit=100`
    );
    if (res.ok) {
      const markets = await res.json();
      const list = Array.isArray(markets) ? markets : [];
      for (const m of list) {
        if (m.condition_id) {
          marketMap[m.condition_id] = {
            question: m.question ?? m.title ?? '',
            id: String(m.id ?? ''),
            slug: m.slug ?? '',
            outcomes: Array.isArray(m.outcomes)
              ? m.outcomes
              : typeof m.outcomes === 'string'
                ? JSON.parse(m.outcomes)
                : ['Yes', 'No'],
          };
        }
      }
    }
  } catch {
    // Enrichment is best-effort — positions still show without names
  }

  return positions.map((p) => {
    const market = marketMap[p.condition_id];
    const outcomes = market?.outcomes ?? ['Yes', 'No'];
    return {
      ...p,
      marketQuestion: market?.question ?? null,
      marketId: market?.id ?? null,
      marketSlug: market?.slug ?? null,
      outcomeName: outcomes[p.outcome_index] ?? (p.outcome_index === 0 ? 'Yes' : 'No'),
    };
  });
}

/**
 * Fetch user positions, enriched with market names from Gamma API
 */
export function usePositions() {
  const address = useWalletStore((state) => state.address);

  return useQuery({
    queryKey: positionKeys.user(address ?? ''),
    queryFn: async () => {
      if (!address) return [];
      const positions = await dataClient.getOpenPositions(address);
      return enrichPositionsWithMarketData(positions);
    },
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
 * Fetch portfolio summary (enriched with market names)
 */
export function usePortfolio() {
  const address = useWalletStore((state) => state.address);

  return useQuery({
    queryKey: positionKeys.portfolio(address ?? ''),
    queryFn: async () => {
      if (!address) return null;
      const raw = await dataClient.getPortfolioValue(address);
      const positions = await enrichPositionsWithMarketData(raw.positions);
      return { ...raw, positions };
    },
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
    {} as Record<string, EnrichedPosition[]>
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
