/**
 * ClickHouse Indexer API client
 * Server-side: call ClickHouse directly; Client-side: use proxy
 */

const isServer = typeof window === 'undefined';
const CLICKHOUSE_URL = isServer
  ? (process.env.CLICKHOUSE_URL ?? 'http://127.0.0.1:3002')
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
  realizedPnlUsd: number;
  netCashflowUsd: number;
  totalPnl: number;          // Legacy (equals netCashflowUsd)
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

export interface ExplainEvent {
  eventId: string;
  txHash: string;
  blockTimestamp: string;
  blockTimestampUnix: number;
  tokenId: string;
  conditionId: string;
  eventType: string;
  quantity: number;
  usdcDeltaUsd: number;
  costBasisUsd: number;
  realizedPnlUsd: number;
  runningRealizedPnlUsd: number;
  runningConditionShares: number | null;
}

export interface ExplainSummary {
  totalEvents: number;
  realizedPnlUsd: number;
  cashflowUsd: number;
  marketsTraded: number;
  eventCountReturned: number;
  eventLimit: number;
}

export interface LeaderboardExplainResponse {
  user: string;
  period: string;
  summary: ExplainSummary;
  events: ExplainEvent[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
}

export interface CandleResponse {
  conditionId: string;
  tokenId: string;
  interval: string;
  candles: Candle[];
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

export interface Position {
  asset: string;
  condition_id: string;
  outcome_index: number;
  /** Human-friendly outcome name (if available from ClickHouse metadata sync). */
  outcome?: string;
  /** Market question (if available from ClickHouse metadata sync). */
  question?: string;
  /** Market slug (if available from ClickHouse metadata sync). */
  slug?: string;

  size: number;
  avg_price?: number;

  // Optional enhanced fields (may not exist yet depending on indexer version).
  current_price?: number;
  current_value?: number;
  unrealized_pnl?: number;
  price_updated_at_ms?: number;
  categories?: string[];
  event_id?: string;

  // Legacy/compat fields some indexers return
  initial_value?: number;
  realized_pnl?: number;
  pnl_percent?: number;
}

export interface DiscoverMarket {
  // Indexer-backed IDs (preferred).
  marketId: string;
  eventId?: string | null;
  category?: string | null;

  question: string;
  outcomes?: string[];
  outcomePrices?: number[];

  // Windowed metrics (depends on backend implementation).
  volume?: number;
  liquidity?: number;
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
  category?: string,
  eventId?: string,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (sort) params.set('sort', sort);
  if (limit) params.set('limit', limit.toString());
  if (period) params.set('period', period);
  if (category) params.set('category', category);
  if (eventId) params.set('eventId', eventId);
  return fetchClickHouse<LeaderboardResponse>(`/leaderboard?${params}`);
}

export async function getLeaderboardExplain(opts: {
  user: string;
  metric?: string;
  period?: string;
  conditionId?: string;
  from?: number;
  to?: number;
  limit?: number;
}): Promise<LeaderboardExplainResponse> {
  const params = new URLSearchParams();
  params.set('user', opts.user);
  if (opts.metric) params.set('metric', opts.metric);
  if (opts.period) params.set('period', opts.period);
  if (opts.conditionId) params.set('conditionId', opts.conditionId);
  if (opts.from != null) params.set('from', opts.from.toString());
  if (opts.to != null) params.set('to', opts.to.toString());
  if (opts.limit != null) params.set('limit', opts.limit.toString());
  return fetchClickHouse<LeaderboardExplainResponse>(`/leaderboard/explain?${params}`);
}

export async function getOnChainTrades(
  tokenId: string,
  limit?: number,
  offset?: number,
  from?: number,
  to?: number,
): Promise<OnChainTrade[]> {
  const params = new URLSearchParams();
  params.set('tokenId', tokenId);
  if (limit) params.set('limit', limit.toString());
  if (offset) params.set('offset', offset.toString());
  if (from != null) params.set('from', from.toString());
  if (to != null) params.set('to', to.toString());
  return fetchClickHouse<OnChainTrade[]>(`/trades?${params}`);
}

export async function getPositions(user: string): Promise<Position[]> {
  const params = new URLSearchParams();
  params.set('user', user);
  return fetchClickHouse<Position[]>(`/positions?${params}`);
}

export async function getDiscoverMarkets(opts: {
  window: string;
  limit?: number;
  offset?: number;
  category?: string;
  eventId?: string;
}): Promise<DiscoverMarket[]> {
  const params = new URLSearchParams();
  params.set('window', opts.window);
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  if (opts.category) params.set('category', opts.category);
  if (opts.eventId) params.set('eventId', opts.eventId);

  const raw = await fetchClickHouse<unknown>(`/discover/markets?${params}`);
  const list = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data))
      ? (raw as { data: unknown[] }).data
      : [];

  return list.map((m: any) => {
    const marketId = String(m.marketId ?? m.market_id ?? m.id ?? '');
    const question = String(m.question ?? m.title ?? '');

    const outcomes = Array.isArray(m.outcomes)
      ? m.outcomes.map(String)
      : typeof m.outcomes === 'string'
        ? (() => { try { return JSON.parse(m.outcomes).map(String); } catch { return undefined; } })()
        : undefined;

    const outcomePrices = Array.isArray(m.outcomePrices)
      ? m.outcomePrices.map(Number)
      : typeof m.outcomePrices === 'string'
        ? (() => { try { return JSON.parse(m.outcomePrices).map(Number); } catch { return undefined; } })()
        : Array.isArray(m.outcome_prices)
          ? m.outcome_prices.map(Number)
          : undefined;

    return {
      marketId,
      eventId: m.eventId ?? m.event_id ?? null,
      category: m.category ?? null,
      question,
      outcomes,
      outcomePrices,
      volume: typeof m.volume === 'number' ? m.volume : (typeof m.volumeUsd === 'number' ? m.volumeUsd : undefined),
      liquidity: typeof m.liquidity === 'number' ? m.liquidity : undefined,
    };
  }).filter((m) => m.marketId && m.question);
}

export async function getMarketCandles(opts: {
  conditionId?: string;
  tokenId?: string;
  interval?: string;
  from?: number;
  to?: number;
  limit?: number;
}): Promise<CandleResponse> {
  const params = new URLSearchParams();
  if (opts.conditionId) params.set('conditionId', opts.conditionId);
  if (opts.tokenId) params.set('tokenId', opts.tokenId);
  if (opts.interval) params.set('interval', opts.interval);
  if (opts.from) params.set('from', opts.from.toString());
  if (opts.to) params.set('to', opts.to.toString());
  if (opts.limit) params.set('limit', opts.limit.toString());
  return fetchClickHouse<CandleResponse>(`/market/candles?${params}`);
}
