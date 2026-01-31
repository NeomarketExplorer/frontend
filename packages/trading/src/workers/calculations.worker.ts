/**
 * Calculations Web Worker
 * Handles heavy trading calculations off the main thread
 */

import * as Comlink from 'comlink';

export interface Trade {
  id: string;
  price: number;
  size: number;
  timestamp: number;
  side: 'BUY' | 'SELL';
}

export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  marketId: string;
  outcomeId: string;
  size: number;
  avgPrice: number;
  currentPrice: number;
}

export interface PnLResult {
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  totalValue: number;
  totalCost: number;
}

const calculationsWorker = {
  /**
   * Transform trades to OHLC bars for TradingView charts
   */
  tradesToOHLC(trades: Trade[], intervalMs: number = 60000): OHLCBar[] {
    if (trades.length === 0) return [];

    // Sort by timestamp
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    const bars: OHLCBar[] = [];
    let currentBar: OHLCBar | null = null;
    let currentIntervalStart = 0;

    for (const trade of sorted) {
      const intervalStart = Math.floor(trade.timestamp / intervalMs) * intervalMs;

      if (currentBar === null || intervalStart !== currentIntervalStart) {
        if (currentBar) {
          bars.push(currentBar);
        }
        currentIntervalStart = intervalStart;
        currentBar = {
          time: intervalStart / 1000, // TradingView uses seconds
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          volume: trade.size,
        };
      } else {
        currentBar.high = Math.max(currentBar.high, trade.price);
        currentBar.low = Math.min(currentBar.low, trade.price);
        currentBar.close = trade.price;
        currentBar.volume += trade.size;
      }
    }

    if (currentBar) {
      bars.push(currentBar);
    }

    return bars;
  },

  /**
   * Calculate portfolio P&L
   */
  calculatePortfolioPnL(positions: Position[]): PnLResult {
    let totalValue = 0;
    let totalCost = 0;

    for (const position of positions) {
      totalValue += position.currentPrice * position.size;
      totalCost += position.avgPrice * position.size;
    }

    const unrealizedPnL = totalValue - totalCost;
    const unrealizedPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;

    return {
      unrealizedPnL,
      unrealizedPnLPercent,
      totalValue,
      totalCost,
    };
  },

  /**
   * Calculate VWAP from trades
   */
  calculateVWAP(trades: Trade[]): number {
    if (trades.length === 0) return 0;

    let totalValue = 0;
    let totalVolume = 0;

    for (const trade of trades) {
      totalValue += trade.price * trade.size;
      totalVolume += trade.size;
    }

    return totalVolume > 0 ? totalValue / totalVolume : 0;
  },

  /**
   * Generate CSV from positions data
   */
  positionsToCSV(positions: Position[]): string {
    const headers = ['Market ID', 'Outcome ID', 'Size', 'Avg Price', 'Current Price', 'P&L', 'P&L %'];
    const rows = positions.map(p => {
      const pnl = (p.currentPrice - p.avgPrice) * p.size;
      const pnlPercent = p.avgPrice > 0 ? ((p.currentPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
      return [
        p.marketId,
        p.outcomeId,
        p.size.toFixed(2),
        p.avgPrice.toFixed(4),
        p.currentPrice.toFixed(4),
        pnl.toFixed(2),
        pnlPercent.toFixed(2) + '%',
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },
};

export type CalculationsWorker = typeof calculationsWorker;

Comlink.expose(calculationsWorker);
