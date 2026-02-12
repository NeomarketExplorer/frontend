'use client';

import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '@/stores';
import {
  getPortfolioHistory,
  getLeaderboard,
  getMarketCandles,
  getMarketStats,
  getOnChainTrades,
  getUserStats,
  type CandleResponse,
  type PortfolioHistory,
  type UserStats,
  type MarketStats,
  type LeaderboardResponse,
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

export function useOnChainTrades(tokenId?: string | null, limit?: number) {
  return useQuery<OnChainTrade[]>({
    queryKey: ['ch-trades', tokenId, limit],
    queryFn: () => getOnChainTrades(tokenId!, limit),
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
