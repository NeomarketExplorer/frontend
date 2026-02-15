'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMarkets, type IndexerMarket } from '@/lib/indexer';
import { buildOpportunities, type OpportunityOptions } from '@/lib/opportunities';

function useOpportunityMarkets() {
  return useQuery({
    queryKey: ['opportunities-markets'],
    queryFn: async () => {
      const [page1, page2] = await Promise.all([
        getMarkets({ limit: 100, offset: 0, closed: false, sort: 'volume', order: 'desc' }),
        getMarkets({ limit: 100, offset: 100, closed: false, sort: 'volume', order: 'desc' }),
      ]);
      return [...page1.data, ...page2.data] as IndexerMarket[];
    },
    staleTime: 5 * 60_000,        // 5 min — opportunities data doesn't change fast
    gcTime: 10 * 60_000,           // keep in cache 10 min
    refetchInterval: 5 * 60_000,   // refresh every 5 min
    refetchOnWindowFocus: false,    // don't refetch on tab focus
  });
}

export function useOpportunities(options: OpportunityOptions = {}) {
  const { data: markets, isLoading, error } = useOpportunityMarkets();

  const opportunities = useMemo(() => {
    if (!markets) return undefined;
    return buildOpportunities(markets, options);
  }, [markets, options.minProbability, options.maxDaysToExpiry, options.sortBy]);

  return { data: opportunities, isLoading, error };
}
