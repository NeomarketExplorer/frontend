/**
 * Orderbook utilities
 */

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

/**
 * Calculate spread between best bid and ask
 */
export function calculateSpread(orderbook: Orderbook): number | null {
  if (orderbook.bids.length === 0 || orderbook.asks.length === 0) {
    return null;
  }

  const bestBid = orderbook.bids[0].price;
  const bestAsk = orderbook.asks[0].price;

  return bestAsk - bestBid;
}

/**
 * Calculate mid price
 */
export function calculateMidPrice(orderbook: Orderbook): number | null {
  if (orderbook.bids.length === 0 || orderbook.asks.length === 0) {
    return null;
  }

  const bestBid = orderbook.bids[0].price;
  const bestAsk = orderbook.asks[0].price;

  return (bestBid + bestAsk) / 2;
}

/**
 * Calculate total liquidity at price levels
 */
export function calculateDepth(levels: OrderbookLevel[]): number {
  return levels.reduce((sum, level) => sum + level.size, 0);
}

/**
 * Get cumulative depth for visualization
 */
export function getCumulativeDepth(levels: OrderbookLevel[]): OrderbookLevel[] {
  let cumulative = 0;
  return levels.map(level => ({
    price: level.price,
    size: (cumulative += level.size),
  }));
}
