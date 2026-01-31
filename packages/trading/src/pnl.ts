/**
 * P&L (Profit and Loss) calculations
 */

export interface Position {
  size: number;
  avgPrice: number;
  currentPrice: number;
}

/**
 * Calculate unrealized P&L for a position
 */
export function calculateUnrealizedPnL(position: Position): number {
  return (position.currentPrice - position.avgPrice) * position.size;
}

/**
 * Calculate unrealized P&L percentage
 */
export function calculateUnrealizedPnLPercent(position: Position): number {
  if (position.avgPrice === 0) return 0;
  return ((position.currentPrice - position.avgPrice) / position.avgPrice) * 100;
}

/**
 * Calculate total portfolio value
 */
export function calculatePortfolioValue(positions: Position[]): number {
  return positions.reduce((sum, pos) => sum + pos.currentPrice * pos.size, 0);
}

/**
 * Calculate total unrealized P&L
 */
export function calculateTotalUnrealizedPnL(positions: Position[]): number {
  return positions.reduce((sum, pos) => sum + calculateUnrealizedPnL(pos), 0);
}

/**
 * Calculate potential payout if position wins (resolves to 1)
 */
export function calculatePotentialPayout(position: Position): number {
  return position.size; // Each share pays $1 if it wins
}

/**
 * Calculate max loss (position cost)
 */
export function calculateMaxLoss(position: Position): number {
  return position.avgPrice * position.size;
}
