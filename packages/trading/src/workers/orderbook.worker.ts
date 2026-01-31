/**
 * Orderbook Web Worker
 * Handles orderbook aggregation and updates off the main thread
 */

import * as Comlink from 'comlink';

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
}

export interface AggregatedOrderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number | null;
  midPrice: number | null;
  totalBidDepth: number;
  totalAskDepth: number;
}

export interface OrderbookDelta {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

const orderbookWorker = {
  /**
   * Aggregate orderbook levels by price precision
   */
  aggregateOrderbook(
    orderbook: Orderbook,
    pricePrecision: number = 0.01
  ): AggregatedOrderbook {
    const aggregateLevels = (levels: OrderbookLevel[], ascending: boolean): OrderbookLevel[] => {
      const grouped = new Map<number, number>();

      for (const level of levels) {
        const roundedPrice = Math.round(level.price / pricePrecision) * pricePrecision;
        grouped.set(roundedPrice, (grouped.get(roundedPrice) || 0) + level.size);
      }

      const result = Array.from(grouped.entries())
        .map(([price, size]) => ({ price, size }))
        .sort((a, b) => (ascending ? a.price - b.price : b.price - a.price));

      return result;
    };

    const bids = aggregateLevels(orderbook.bids, false);
    const asks = aggregateLevels(orderbook.asks, true);

    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;

    const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
    const midPrice = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;

    const totalBidDepth = bids.reduce((sum, l) => sum + l.size, 0);
    const totalAskDepth = asks.reduce((sum, l) => sum + l.size, 0);

    return {
      bids,
      asks,
      spread,
      midPrice,
      totalBidDepth,
      totalAskDepth,
    };
  },

  /**
   * Apply delta updates to orderbook
   */
  applyDelta(orderbook: Orderbook, delta: OrderbookDelta): Orderbook {
    const applyDeltaToSide = (
      levels: OrderbookLevel[],
      updates: OrderbookLevel[]
    ): OrderbookLevel[] => {
      const levelMap = new Map<number, number>();

      // Add existing levels
      for (const level of levels) {
        levelMap.set(level.price, level.size);
      }

      // Apply updates
      for (const update of updates) {
        if (update.size === 0) {
          levelMap.delete(update.price);
        } else {
          levelMap.set(update.price, update.size);
        }
      }

      return Array.from(levelMap.entries()).map(([price, size]) => ({ price, size }));
    };

    return {
      bids: applyDeltaToSide(orderbook.bids, delta.bids),
      asks: applyDeltaToSide(orderbook.asks, delta.asks),
      timestamp: Date.now(),
    };
  },

  /**
   * Calculate cumulative depth for visualization
   */
  calculateCumulativeDepth(levels: OrderbookLevel[]): OrderbookLevel[] {
    let cumulative = 0;
    return levels.map(level => ({
      price: level.price,
      size: (cumulative += level.size),
    }));
  },

  /**
   * Get best N levels from each side
   */
  getTopLevels(orderbook: Orderbook, n: number = 10): Orderbook {
    return {
      bids: orderbook.bids.slice(0, n),
      asks: orderbook.asks.slice(0, n),
      timestamp: orderbook.timestamp,
    };
  },
};

export type OrderbookWorker = typeof orderbookWorker;

Comlink.expose(orderbookWorker);
