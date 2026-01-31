import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  calculatePotentialReturn,
  calculateReturnPercent,
  calculateMaxSize,
  formatPriceToCents,
  formatUSD,
} from './calculations';

describe('Trading Calculations', () => {
  describe('calculateCost', () => {
    it('should calculate cost correctly', () => {
      expect(calculateCost(0.65, 100)).toBe(65);
      expect(calculateCost(0.33, 50)).toBe(16.5);
    });

    it('should handle zero values', () => {
      expect(calculateCost(0, 100)).toBe(0);
      expect(calculateCost(0.5, 0)).toBe(0);
    });
  });

  describe('calculatePotentialReturn', () => {
    it('should calculate potential return correctly', () => {
      // Buy 100 shares at $0.65 = $65 cost, payout = $100, return = $35
      expect(calculatePotentialReturn(0.65, 100)).toBe(35);
      expect(calculatePotentialReturn(0.33, 50)).toBe(33.5);
    });
  });

  describe('calculateReturnPercent', () => {
    it('should calculate return percentage correctly', () => {
      // At 0.50 price, return is 100%
      expect(calculateReturnPercent(0.5)).toBe(100);
      // At 0.25 price, return is 300%
      expect(calculateReturnPercent(0.25)).toBe(300);
    });

    it('should handle zero price', () => {
      expect(calculateReturnPercent(0)).toBe(Infinity);
    });
  });

  describe('calculateMaxSize', () => {
    it('should calculate max buyable shares', () => {
      expect(calculateMaxSize(100, 0.5)).toBe(200);
      expect(calculateMaxSize(65, 0.65)).toBe(100);
    });

    it('should handle zero price', () => {
      expect(calculateMaxSize(100, 0)).toBe(0);
    });
  });

  describe('formatPriceToCents', () => {
    it('should format price to cents', () => {
      expect(formatPriceToCents(0.65)).toBe('65.0¢');
      expect(formatPriceToCents(0.333)).toBe('33.3¢');
    });
  });

  describe('formatUSD', () => {
    it('should format as USD currency', () => {
      expect(formatUSD(1234.56)).toBe('$1,234.56');
      expect(formatUSD(0)).toBe('$0.00');
    });
  });
});
