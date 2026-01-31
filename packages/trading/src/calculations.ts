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
