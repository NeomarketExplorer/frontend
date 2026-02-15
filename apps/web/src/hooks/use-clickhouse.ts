'use client';

import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '@/stores';
import {
  getPortfolioHistory,
  getLeaderboard,
  getLeaderboardExplain,
  getMarketCandles,
  getMarketStats,
  getOnChainTrades,
  getUserStats,
  type CandleResponse,
  type PortfolioHistory,
  type UserStats,
  type MarketStats,
  type LeaderboardResponse,
  type LeaderboardExplainResponse,
  type OnChainTrade,
} from '@/lib/clickhouse';

export function usePortfolioHistory(interval?: string, from?: string) {
  const address = useWalletStore((s) => s.address);

  return useQuery<PortfolioHistory>({
    queryKey: ['ch-portfolio', address, interval, from],
    queryFn: () => getPortfolioHistory(address!, interval, from),
    enabled: !!address,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useUserStats(address?: string | null) {
  const walletAddress = useWalletStore((s) => s.address);
  const user = address ?? walletAddress;

  return useQuery<UserStats>({
    queryKey: ['ch-user-stats', user],
    queryFn: () => getUserStats(user!),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarketStats(conditionId?: string | null) {
  return useQuery<MarketStats>({
    queryKey: ['ch-market-stats', conditionId],
    queryFn: () => getMarketStats({ conditionId: conditionId! }),
    enabled: !!conditionId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useLeaderboard(sort?: string, period?: string) {
  return useQuery<LeaderboardResponse>({
    queryKey: ['ch-leaderboard', sort, period],
    queryFn: () => getLeaderboard(sort, undefined, period),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useLeaderboardFiltered(opts: {
  sort?: string;
  period?: string;
  category?: string | null;
  eventId?: string | null;
  limit?: number;
}) {
  const sort = opts.sort;
  const period = opts.period;
  const category = opts.category ?? undefined;
  const eventId = opts.eventId ?? undefined;
  const limit = opts.limit;

  return useQuery<LeaderboardResponse>({
    queryKey: ['ch-leaderboard', sort, period, category, eventId, limit],
    queryFn: () => getLeaderboard(sort, limit, period, category, eventId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useOnChainTrades(
  tokenId?: string | null,
  limit?: number,
  from?: number,
  to?: number,
) {
  return useQuery<OnChainTrade[]>({
    queryKey: ['ch-trades', tokenId, limit, from, to],
    queryFn: () => getOnChainTrades(tokenId!, limit, undefined, from, to),
    enabled: !!tokenId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarketCandles(
  conditionId?: string | null,
  tokenId?: string | null,
  interval?: string,
) {
  return useQuery<CandleResponse>({
    queryKey: ['ch-candles', conditionId, tokenId, interval],
    queryFn: () =>
      getMarketCandles({
        conditionId: conditionId!,
        tokenId: tokenId ?? undefined,
        interval,
      }),
    enabled: !!conditionId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useLeaderboardExplain(
  user?: string | null,
  opts?: { metric?: string; period?: string; limit?: number },
) {
  const metric = opts?.metric;
  const period = opts?.period;
  const limit = opts?.limit;

  return useQuery<LeaderboardExplainResponse>({
    queryKey: ['ch-leaderboard-explain', user, metric, period, limit],
    queryFn: () =>
      getLeaderboardExplain({
        user: user!,
        metric,
        period,
        limit,
      }),
    enabled: !!user,
    staleTime: 30_000,
  });
}
