/**
 * ClickHouse Indexer API client
 * Server-side: call ClickHouse directly; Client-side: use proxy
 */

const isServer = typeof window === 'undefined';
const CLICKHOUSE_URL = isServer
  ? (process.env.CLICKHOUSE_URL || 'http://138.201.57.139:3002')
  : '/api/clickhouse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
  positions: number;
  pnl: number;
}

export interface PortfolioHistory {
  user: string;
  interval: string;
  snapshots: PortfolioSnapshot[];
}

export interface UserStats {
  user: string;
  totalTrades: number;
  totalVolume: number;
  marketsTraded: number;
  winCount: number | null;
  lossCount: number | null;
  winRate: number | null;
  totalRealizedPnl: number | null;
  bestTrade: { market: string; conditionId: string; pnl: number } | null;
  worstTrade: { market: string; conditionId: string; pnl: number } | null;
  firstTradeAt: number;
  lastTradeAt: number;
  avgTradeSize: number;
}

export interface MarketStats {
  conditionId: string;
  uniqueTraders: number;
  totalTrades: number;
  onChainVolume: number;
  volume24h: number;
  volume7d: number;
  avgTradeSize: number;
  largestTrade: number;
  lastTradeAt: number;
  holderCount: number;
  topHolders: { user: string; balance: number; percentage: number }[];
}

export interface LeaderboardTrader {
  rank: number;
  user: string;
  totalPnl: number;
  totalVolume: number;
  totalTrades: number;
  winRate: number | null;
  marketsTraded: number;
}

export interface LeaderboardResponse {
  period: string;
  sort: string;
  updatedAt: number;
  traders: LeaderboardTrader[];
}

export interface OnChainTrade {
  id: string;
  price: number;
  size: number;
  side: string;
  maker: string;
  taker: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchClickHouse<T>(path: string): Promise<T> {
  const url = `${CLICKHOUSE_URL}${path}`;

  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickHouse API error: ${res.status} - ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getPortfolioHistory(
  user: string,
  interval?: string,
  from?: string,
  to?: string,
): Promise<PortfolioHistory> {
  const params = new URLSearchParams();
  params.set('user', user);
  if (interval) params.set('interval', interval);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return fetchClickHouse<PortfolioHistory>(`/portfolio/history?${params}`);
}

export async function getUserStats(user: string): Promise<UserStats> {
  const params = new URLSearchParams();
  params.set('user', user);
  return fetchClickHouse<UserStats>(`/user/stats?${params}`);
}

export async function getMarketStats(opts: {
  conditionId?: string;
  tokenId?: string;
}): Promise<MarketStats> {
  const params = new URLSearchParams();
  if (opts.conditionId) params.set('conditionId', opts.conditionId);
  if (opts.tokenId) params.set('tokenId', opts.tokenId);
  return fetchClickHouse<MarketStats>(`/market/stats?${params}`);
}

export async function getLeaderboard(
  sort?: string,
  limit?: number,
  period?: string,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (sort) params.set('sort', sort);
  if (limit) params.set('limit', limit.toString());
  if (period) params.set('period', period);
  return fetchClickHouse<LeaderboardResponse>(`/leaderboard?${params}`);
}

export async function getOnChainTrades(
  tokenId: string,
  limit?: number,
  offset?: number,
): Promise<OnChainTrade[]> {
  const params = new URLSearchParams();
  params.set('tokenId', tokenId);
  if (limit) params.set('limit', limit.toString());
  if (offset) params.set('offset', offset.toString());
  return fetchClickHouse<OnChainTrade[]>(`/trades?${params}`);
}
