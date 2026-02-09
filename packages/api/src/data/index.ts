/**
 * Data API client - Positions and activity
 * https://data-api.polymarket.com
 */

import { z } from 'zod';
import { ApiClient, createApiClient, type ApiClientConfig } from '../client';

// Data API Schemas
export const PositionSchema = z.object({
  asset: z.string(),
  condition_id: z.string(),
  outcome_index: z.number(),
  size: z.number(),
  avg_price: z.number().optional(),
  cur_price: z.number().optional(),
  initial_value: z.number().optional(),
  current_value: z.number().optional(),
  pnl: z.number().optional(),
  pnl_percent: z.number().optional(),
  realized_pnl: z.number().optional(),
  unrealized_pnl: z.number().optional(),
}).passthrough();

export const ActivitySchema = z.object({
  id: z.string().optional(),
  type: z.enum(['trade', 'transfer', 'redeem', 'split', 'merge']),
  timestamp: z.string(),
  asset: z.string().optional(),
  condition_id: z.string().optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
  price: z.number().optional(),
  size: z.number().optional(),
  value: z.number().optional(),
  fee: z.number().optional(),
  transaction_hash: z.string().optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// Normalize helpers — Polymarket Data API returns camelCase, we use snake_case
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizePosition(raw: any): any {
  if (typeof raw !== 'object' || raw === null) return raw;
  return {
    ...raw,
    condition_id: raw.conditionId ?? raw.condition_id,
    outcome_index: raw.outcomeIndex ?? raw.outcome_index,
    avg_price: raw.avgPrice ?? raw.avg_price,
    cur_price: raw.curPrice ?? raw.cur_price,
    initial_value: raw.initialValue ?? raw.initial_value,
    current_value: raw.currentValue ?? raw.current_value,
    pnl: raw.cashPnl ?? raw.pnl,
    pnl_percent: raw.percentPnl ?? raw.pnl_percent,
    realized_pnl: raw.realizedPnl ?? raw.realized_pnl,
    unrealized_pnl: raw.unrealizedPnl ?? raw.unrealized_pnl,
  };
}

function normalizeActivity(raw: any): any {
  if (typeof raw !== 'object' || raw === null) return raw;
  return {
    ...raw,
    type: typeof raw.type === 'string' ? raw.type.toLowerCase() : raw.type,
    condition_id: raw.conditionId ?? raw.condition_id,
    timestamp: typeof raw.timestamp === 'number'
      ? new Date(raw.timestamp * 1000).toISOString()
      : raw.timestamp,
    value: raw.usdcSize ?? raw.value,
    transaction_hash: raw.transactionHash ?? raw.transaction_hash,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const UserBalanceSchema = z.object({
  usdc: z.number(),
  conditional_tokens: z.record(z.number()),
});

export type Position = z.infer<typeof PositionSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type UserBalance = z.infer<typeof UserBalanceSchema>;

export interface PositionsParams {
  user: string;
  sizeThreshold?: number;
}

export interface ActivityParams {
  user: string;
  limit?: number;
  offset?: number;
  type?: Activity['type'];
}

export class DataClient {
  private client: ApiClient;

  constructor(config?: Partial<ApiClientConfig>) {
    this.client = createApiClient({
      baseUrl: config?.baseUrl ?? 'https://data-api.polymarket.com',
      ...config,
    });
  }

  /**
   * Get user positions
   */
  async getPositions(user: string, sizeThreshold = 0): Promise<Position[]> {
    const raw = await this.client.get<unknown[]>(
      '/positions',
      { params: { user, sizeThreshold } },
    );
    const normalized = (Array.isArray(raw) ? raw : []).map(normalizePosition);
    return z.array(PositionSchema).parse(normalized);
  }

  /**
   * Get user activity/history
   */
  async getActivity(
    user: string,
    options: Partial<Omit<ActivityParams, 'user'>> = {}
  ): Promise<Activity[]> {
    const raw = await this.client.get<unknown[]>(
      '/activity',
      { params: { user, ...options } },
    );
    const normalized = (Array.isArray(raw) ? raw : []).map(normalizeActivity);
    return z.array(ActivitySchema).parse(normalized);
  }

  /**
   * Get open positions (size > 0)
   */
  async getOpenPositions(user: string): Promise<Position[]> {
    const positions = await this.getPositions(user, 0);
    return positions.filter(p => p.size > 0);
  }

  /**
   * Get positions that can be claimed (resolved markets)
   * This requires combining with Gamma API data to check market status
   */
  async getClaimablePositions(
    user: string,
    resolvedMarketIds: Set<string>
  ): Promise<Position[]> {
    const positions = await this.getOpenPositions(user);
    return positions.filter(p => resolvedMarketIds.has(p.condition_id));
  }

  /**
   * Calculate total portfolio value
   */
  async getPortfolioValue(user: string): Promise<{
    totalValue: number;
    totalPnL: number;
    positions: Position[];
  }> {
    const positions = await this.getOpenPositions(user);

    let totalValue = 0;
    let totalPnL = 0;

    for (const position of positions) {
      totalValue += position.current_value ?? 0;
      totalPnL += position.pnl ?? 0;
    }

    return { totalValue, totalPnL, positions };
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(user: string, limit = 20): Promise<Activity[]> {
    const activity = await this.getActivity(user, { limit, type: 'trade' });
    return activity;
  }
}

/**
 * Create a Data API client
 */
export function createDataClient(config?: Partial<ApiClientConfig>): DataClient {
  return new DataClient(config);
}
