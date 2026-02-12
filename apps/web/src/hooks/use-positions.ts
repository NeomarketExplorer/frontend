/**
 * TanStack Query hooks for positions and portfolio data.
 * Fetches from Polymarket Data API via /api/data proxy,
 * then enriches positions with market names from Gamma API.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createDataClient, type Position } from '@app/api';
import { useWalletStore } from '@/stores/wallet-store';
import { searchMarkets } from '@/lib/indexer';

// Route through proxy to avoid CORS
const dataClient = createDataClient({ baseUrl: '/api/data' });

// Query keys
export const positionKeys = {
  all: ['positions'] as const,
  user: (address: string) => [...positionKeys.all, address] as const,
  resolved: (address: string) => [...positionKeys.all, 'resolved', address] as const,
  activity: (address: string) => [...positionKeys.all, 'activity', address] as const,
  portfolio: (address: string) => [...positionKeys.all, 'portfolio', address] as const,
};

export interface EnrichedPosition extends Position {
  marketQuestion: string | null;
  marketId: string | null;
  marketSlug: string | null;
  outcomeName: string;
  /** Whether the market has been resolved/closed */
  marketClosed: boolean;
  /** The final resolution price (if resolved) */
  resolutionPrice: number | null;
}

interface MarketInfo {
  question: string;
  id: string;
  slug: string;
  outcomes: string[];
  closed: boolean;
  outcomePrices: number[];
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
  const marketMap: Record<string, MarketInfo> = {};
  try {
    const res = await fetch(
      `/api/gamma/markets?condition_ids=${conditionIds.join(',')}&limit=100`
    );
    if (res.ok) {
      const markets = await res.json();
      const list = Array.isArray(markets) ? markets : [];
      for (const m of list) {
        if (m.condition_id) {
          let outcomePrices: number[] = [];
          try {
            if (typeof m.outcomePrices === 'string') {
              outcomePrices = JSON.parse(m.outcomePrices).map(Number);
            } else if (Array.isArray(m.outcomePrices)) {
              outcomePrices = m.outcomePrices.map(Number);
            }
          } catch {
            // ignore parse errors
          }
          marketMap[m.condition_id] = {
            question: m.question ?? m.title ?? '',
            id: String(m.id ?? ''),
            slug: m.slug ?? '',
            outcomes: Array.isArray(m.outcomes)
              ? m.outcomes
              : typeof m.outcomes === 'string'
                ? JSON.parse(m.outcomes)
                : ['Yes', 'No'],
            closed: m.closed === true,
            outcomePrices,
          };
        }
      }
    }
  } catch {
    // Enrichment is best-effort — positions still show without names
  }

  // Secondary fallback: try indexer for any positions not enriched by Gamma
  const unenrichedIds = conditionIds.filter((id) => !marketMap[id]);
  if (unenrichedIds.length > 0) {
    const lookups = unenrichedIds.map(async (conditionId) => {
      try {
        const results = await searchMarkets(conditionId, 1);
        const match = results.find(
          (m) => m.conditionId?.toLowerCase() === conditionId.toLowerCase()
        );
        if (match) {
          marketMap[conditionId] = {
            question: match.question,
            id: String(match.id),
            slug: match.slug ?? '',
            outcomes: match.outcomes ?? ['Yes', 'No'],
            closed: match.closed === true,
            outcomePrices: match.outcomePrices ?? [],
          };
        }
      } catch {
        // Indexer lookup failed — continue
      }
    });
    await Promise.allSettled(lookups);
  }

  return positions.map((p) => {
    const market = marketMap[p.condition_id];
    const outcomes = market?.outcomes ?? ['Yes', 'No'];
    const isClosed = market?.closed ?? false;
    // For resolved markets, the outcome price is 0 or 1
    const resolutionPrice = isClosed && market?.outcomePrices?.length
      ? (market.outcomePrices[p.outcome_index] ?? null)
      : null;
    return {
      ...p,
      marketQuestion: market?.question ?? null,
      marketId: market?.id ?? null,
      marketSlug: market?.slug ?? null,
      outcomeName: outcomes[p.outcome_index] ?? (p.outcome_index === 0 ? 'Yes' : 'No'),
      marketClosed: isClosed,
      resolutionPrice,
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
 * Fetch resolved/closed positions (historical positions where the market has settled).
 * Uses sizeThreshold=-1 to get ALL positions including zero-size,
 * then filters for ones with realized_pnl !== 0 or size === 0 and market closed.
 */
export function useResolvedPositions() {
  const address = useWalletStore((state) => state.address);

  return useQuery({
    queryKey: positionKeys.resolved(address ?? ''),
    queryFn: async () => {
      if (!address) return [];
      // Fetch all positions including zero-size ones
      const allPositions = await dataClient.getPositions(address, -1);
      // Filter for resolved: size=0 with non-zero realized PnL (fully closed out positions)
      const resolved = allPositions.filter(
        (p) => p.size === 0 && p.realized_pnl != null && p.realized_pnl !== 0
      );
      const enriched = await enrichPositionsWithMarketData(resolved);
      // Also include open positions in closed markets
      const openInClosed = (await enrichPositionsWithMarketData(
        allPositions.filter((p) => p.size > 0)
      )).filter((p) => p.marketClosed);
      // Merge and deduplicate by asset
      const seen = new Set<string>();
      const result: EnrichedPosition[] = [];
      for (const p of [...enriched, ...openInClosed]) {
        if (!seen.has(p.asset)) {
          seen.add(p.asset);
          result.push(p);
        }
      }
      return result;
    },
    enabled: !!address,
    staleTime: 60 * 1000,
    refetchInterval: 120 * 1000,
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
