'use client';

import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '@/stores/wallet-store';
import { getLeaderboardExplain, type ExplainEvent } from '@/lib/clickhouse';

export interface CompletedRedemption {
  conditionId: string;
  marketQuestion: string | null;
  marketSlug: string | null;
  totalPayout: number;
  totalCostBasis: number;
  realizedPnl: number;
  txHash: string;
  redeemedAt: string;
  eventCount: number;
}

interface GammaMarket {
  conditionId?: string;
  condition_id?: string;
  question?: string;
  title?: string;
  slug?: string;
}

/**
 * Fetch completed redemptions from ClickHouse leaderboard/explain endpoint.
 * Groups redemption events by conditionId and enriches with Gamma market metadata.
 */
export function useCompletedRedemptions() {
  const address = useWalletStore((state) => state.address);

  return useQuery({
    queryKey: ['completed-redemptions', address],
    queryFn: async (): Promise<CompletedRedemption[]> => {
      if (!address) return [];

      const result = await getLeaderboardExplain({
        user: address,
        metric: 'pnl',
        limit: 500,
      });

      const redemptionEvents = result.events.filter(
        (e) => e.eventType === 'redemption' || e.eventType === 'adapter_redemption'
      );

      if (redemptionEvents.length === 0) return [];

      // Group by conditionId
      const grouped = new Map<string, ExplainEvent[]>();
      for (const event of redemptionEvents) {
        const existing = grouped.get(event.conditionId) ?? [];
        existing.push(event);
        grouped.set(event.conditionId, existing);
      }

      // Aggregate per conditionId
      const conditionIds = [...grouped.keys()];
      const aggregated = conditionIds.map((conditionId) => {
        const events = grouped.get(conditionId)!;
        // Sort by timestamp descending to get the latest
        events.sort((a, b) => b.blockTimestampUnix - a.blockTimestampUnix);

        const totalPayout = events.reduce((sum, e) => sum + e.usdcDeltaUsd, 0);
        const totalCostBasis = events.reduce((sum, e) => sum + Math.abs(e.costBasisUsd), 0);
        const realizedPnl = events.reduce((sum, e) => sum + e.realizedPnlUsd, 0);
        const latest = events[0];

        return {
          conditionId,
          marketQuestion: null as string | null,
          marketSlug: null as string | null,
          totalPayout,
          totalCostBasis,
          realizedPnl,
          txHash: latest.txHash,
          redeemedAt: latest.blockTimestamp,
          eventCount: events.length,
        };
      });

      // Enrich with Gamma market metadata
      try {
        const res = await fetch(
          `/api/gamma/markets?condition_ids=${conditionIds.join(',')}&limit=${conditionIds.length + 10}`
        );
        if (res.ok) {
          const markets: GammaMarket[] = await res.json();
          const list = Array.isArray(markets) ? markets : [];
          const marketMap = new Map<string, { question: string; slug: string }>();
          for (const m of list) {
            const cid = m.conditionId ?? m.condition_id;
            if (cid) {
              marketMap.set(cid.toLowerCase(), {
                question: (m.question ?? m.title ?? '') as string,
                slug: (m.slug ?? '') as string,
              });
            }
          }
          for (const item of aggregated) {
            const info = marketMap.get(item.conditionId.toLowerCase());
            if (info) {
              item.marketQuestion = info.question;
              item.marketSlug = info.slug;
            }
          }
        }
      } catch {
        // Gamma unavailable — redemptions still show, just without market names
      }

      // Sort by date descending (most recent first)
      aggregated.sort(
        (a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime()
      );

      return aggregated;
    },
    enabled: !!address,
    staleTime: 60 * 1000,
    refetchInterval: 120 * 1000,
  });
}
