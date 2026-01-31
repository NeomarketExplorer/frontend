/**
 * TanStack Query hooks for indexer markets data
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getMarkets, getMarket, searchMarkets, type IndexerMarket } from '@/lib/indexer';

// Query keys
export const marketKeys = {
  all: ['markets'] as const,
  lists: () => [...marketKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...marketKeys.lists(), params] as const,
  details: () => [...marketKeys.all, 'detail'] as const,
  detail: (id: string) => [...marketKeys.details(), id] as const,
  trending: () => [...marketKeys.all, 'trending'] as const,
  byCategory: (tag: string) => [...marketKeys.all, 'category', tag] as const,
};

/**
 * Fetch a list of markets
 */
export function useMarkets(params: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  category?: string;
  sort?: 'volume' | 'volume_24hr' | 'liquidity' | 'created_at';
  order?: 'asc' | 'desc';
  search?: string;
} = {}) {
  return useQuery({
    queryKey: marketKeys.list(params),
    queryFn: () => getMarkets(params),
  });
}

/**
 * Fetch a single market by ID
 */
export function useMarket(id: string | null) {
  return useQuery({
    queryKey: marketKeys.detail(id ?? ''),
    queryFn: () => (id ? getMarket(id) : null),
    enabled: !!id,
  });
}

/**
 * Fetch trending markets (sorted by 24h volume)
 */
export function useTrendingMarkets(limit = 10) {
  return useQuery({
    queryKey: [...marketKeys.trending(), limit],
    queryFn: async () => {
      const res = await getMarkets({ limit, sort: 'volume_24hr', order: 'desc', closed: false });
      return res.data;
    },
  });
}

/**
 * Fetch markets by category
 */
export function useMarketsByCategory(tag: string, limit = 50) {
  return useQuery({
    queryKey: [...marketKeys.byCategory(tag), limit],
    queryFn: () => getMarkets({ category: tag, limit, sort: 'volume_24hr', order: 'desc', closed: false }).then(res => res.data),
    enabled: !!tag,
  });
}

/**
 * Infinite query for paginated markets
 */
type MarketsParams = NonNullable<Parameters<typeof getMarkets>[0]>;

export function useInfiniteMarkets(params: Omit<MarketsParams, 'offset'> = {}) {
  const limit = params.limit ?? 20;

  return useInfiniteQuery({
    queryKey: [...marketKeys.lists(), 'infinite', params],
    queryFn: ({ pageParam = 0 }) =>
      getMarkets({ ...params, limit, offset: pageParam }).then((res) => res.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < limit) return undefined;
      return allPages.length * limit;
    },
  });
}

/**
 * Search markets by query string
 */
export function useSearchMarkets(query: string) {
  return useQuery({
    queryKey: [...marketKeys.all, 'search', query],
    queryFn: async () => {
      if (!query.trim()) return [] as IndexerMarket[];
      if (query.trim().length < 2) return [] as IndexerMarket[];
      return searchMarkets(query.trim(), 30);
    },
    enabled: query.length >= 2,
  });
}
