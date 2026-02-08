'use client';

/**
 * Fetches CLOB market metadata (token_id ↔ outcome mapping).
 */

import { useQuery } from '@tanstack/react-query';
import { createClobClient } from '@app/api';

const clobClient = createClobClient({ baseUrl: '/api/clob' });

export function useClobMarket(conditionId: string | null) {
  return useQuery({
    queryKey: ['clob-market', conditionId],
    queryFn: () => (conditionId ? clobClient.getMarket(conditionId) : null),
    enabled: !!conditionId,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}
