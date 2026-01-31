/**
 * Trading calculations - price, size, cost, potential return
 */

/**
 * Calculate the cost of a trade
 */
export function calculateCost(price: number, size: number): number {
  return price * size;
}

/**
 * Calculate potential return for a winning position
 */
export function calculatePotentialReturn(price: number, size: number): number {
  return size - calculateCost(price, size);
}

/**
 * Calculate potential return percentage
 */
export function calculateReturnPercent(price: number): number {
  if (price === 0) return Infinity;
  return ((1 - price) / price) * 100;
}

/**
 * Calculate implied probability from price
 */
export function priceToImpliedProbability(price: number): number {
  return price * 100;
}

/**
 * Calculate max size from available balance and price
 */
export function calculateMaxSize(balance: number, price: number): number {
  if (price === 0) return 0;
  return Math.floor((balance / price) * 100) / 100;
}

/**
 * Format price to cents (0-100 display)
 */
export function formatPriceToCents(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

/**
 * Format USD amount
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface OrderbookLevel {
  price: number;
  size: number;
}

/**
 * Walk orderbook depth to compute the average fill price for a market order.
 *
 * For BUY: walks asks (ascending price). For SELL: walks bids (descending price).
 * Returns the average fill price in decimal (0-1) and total cost in USDC,
 * or null if the book lacks sufficient liquidity.
 *
 * @param levels - Orderbook levels (asks for BUY, bids for SELL), sorted best-first
 * @param size - Number of shares to fill
 */
export function walkOrderbookDepth(
  levels: OrderbookLevel[],
  size: number
): { avgPrice: number; totalCost: number; filledSize: number } | null {
  if (levels.length === 0 || size <= 0) return null;

  let remaining = size;
  let totalCost = 0;
  let filledSize = 0;

  for (const level of levels) {
    if (remaining <= 0) break;
    const fillAtLevel = Math.min(remaining, level.size);
    totalCost += fillAtLevel * level.price;
    filledSize += fillAtLevel;
    remaining -= fillAtLevel;
  }

  if (filledSize === 0) return null;

  return {
    avgPrice: totalCost / filledSize,
    totalCost,
    filledSize,
  };
}
