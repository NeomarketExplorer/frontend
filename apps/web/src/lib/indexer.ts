/**
 * Indexer API client - uses API proxy to avoid CORS/SSR issues
 */

// Server-side: call indexer directly to avoid self-referential fetch
// Client-side: use proxy to avoid CORS
const isServer = typeof window === 'undefined';
const INDEXER_URL = isServer
  ? (process.env.INDEXER_URL || 'http://127.0.0.1:3005')
  : '/api/indexer';

export interface IndexerEvent {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  icon: string | null;
  volume: number;
  volume24hr: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  markets?: IndexerMarket[];
}

export interface IndexerMarket {
  id: string;
  eventId: string | null;
  conditionId: string;
  question: string;
  description: string | null;
  slug: string | null;
  outcomes: string[];
  outcomeTokenIds: string[];
  outcomePrices: number[];
  volume: number;
  volume24hr: number;
  liquidity: number;
  image: string | null;
  icon: string | null;
  category: string | null;
  endDateIso: string | null;
  active: boolean;
  closed: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  event?: {
    id: string;
    title: string;
    slug: string | null;
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface IndexerStats {
  data: {
    markets: { total: number; active: number; closed: number; live: number };
    events: { total: number; active: number; closed: number; live: number };
    trades: { total: number; last24hr: number };
    volume: { total: number; last24hr: number };
    liquidity: number;
    categories: Array<{ name: string; count: number; volume: number }>;
    updatedAt: string;
  };
}

async function fetchIndexer<T>(path: string): Promise<T> {
  // Use /api/indexer proxy routes to avoid CORS and support all endpoints
  const url = `${INDEXER_URL}${path}`;

  const res = await fetch(url, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Indexer API error: ${res.status} - ${text}`);
  }

  return res.json();
}

export async function getEvents(params?: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  sort?: 'volume' | 'volume_24hr' | 'liquidity' | 'created_at';
  order?: 'asc' | 'desc';
  search?: string;
}): Promise<PaginatedResponse<IndexerEvent>> {
  const searchParams = new URLSearchParams();

  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.active !== undefined) searchParams.set('active', params.active.toString());
  if (params?.closed !== undefined) searchParams.set('closed', params.closed.toString());
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return fetchIndexer<PaginatedResponse<IndexerEvent>>(`/events${query ? `?${query}` : ''}`);
}

export async function getEvent(id: string): Promise<IndexerEvent & { markets: IndexerMarket[] }> {
  const res = await fetchIndexer<{ data: IndexerEvent & { markets: IndexerMarket[] } }>(`/events/${id}`);
  return res.data;
}

export async function getMarkets(params?: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  category?: string;
  sort?: 'volume' | 'volume_24hr' | 'liquidity' | 'created_at';
  order?: 'asc' | 'desc';
  search?: string;
}): Promise<PaginatedResponse<IndexerMarket>> {
  const searchParams = new URLSearchParams();

  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.active !== undefined) searchParams.set('active', params.active.toString());
  if (params?.closed !== undefined) searchParams.set('closed', params.closed.toString());
  if (params?.category) searchParams.set('category', params.category);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return fetchIndexer<PaginatedResponse<IndexerMarket>>(`/markets${query ? `?${query}` : ''}`);
}

export async function getMarket(id: string): Promise<IndexerMarket> {
  const res = await fetchIndexer<{ data: IndexerMarket }>(`/markets/${id}`);
  return res.data;
}

export async function searchMarkets(query: string, limit = 20): Promise<IndexerMarket[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('q', query);
  searchParams.set('limit', limit.toString());
  const res = await fetchIndexer<{ data: IndexerMarket[] }>(`/markets/search?${searchParams}`);
  return res.data;
}

export async function getMarketHistory(id: string, interval: '1h' | '6h' | '1d' | '1w' | 'max' = '1w') {
  const searchParams = new URLSearchParams();
  searchParams.set('interval', interval);
  const res = await fetchIndexer<{ data: Array<{ tokenId: string; timestamp: string; price: number }>; interval: string }>(
    `/markets/${id}/history?${searchParams}`
  );
  return res.data;
}

export async function getMarketTrades(id: string, limit = 50) {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', limit.toString());
  const res = await fetchIndexer<{ data: Array<{ id: string; side: string; price: number; size: number; timestamp: string }> }>(
    `/markets/${id}/trades?${searchParams}`
  );
  return res.data;
}

export async function getStats(): Promise<IndexerStats> {
  return fetchIndexer<IndexerStats>('/stats');
}

/**
 * Detects placeholder/test markets that should be hidden from the UI.
 * A market is considered a placeholder if it has no outcome prices AND zero
 * volume (i.e. never had any trading activity).
 *
 * Note: we intentionally do NOT filter on `active` — the indexer sometimes
 * marks live markets as active=false while they are still trading on
 * Polymarket. Markets with volume or prices are never placeholders.
 */
export function isPlaceholderMarket(market: IndexerMarket): boolean {
  if ((!market.outcomePrices || market.outcomePrices.length === 0) && market.volume === 0) return true;
  return false;
}

export function formatVolume(volume: number | null | undefined): string {
  if (volume == null) return '$0';
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(1)}B`;
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return 'N/A';
  return `${(price * 100).toFixed(1)}%`;
}
