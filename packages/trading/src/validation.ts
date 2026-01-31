/**
 * Order validation utilities
 */

import { z } from 'zod';

export const OrderInputSchema = z.object({
  marketId: z.string().min(1, 'Market ID is required'),
  outcomeId: z.string().min(1, 'Outcome ID is required'),
  side: z.enum(['BUY', 'SELL']),
  price: z.number().min(0.01, 'Price must be at least 0.01').max(0.99, 'Price must be at most 0.99'),
  size: z.number().positive('Size must be positive'),
});

export type OrderInput = z.infer<typeof OrderInputSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate order input
 */
export function validateOrder(input: unknown): ValidationResult {
  const result = OrderInputSchema.safeParse(input);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map(e => e.message),
  };
}

/**
 * Check if user has sufficient balance for order
 */
export function validateBalance(
  balance: number,
  price: number,
  size: number,
  side: 'BUY' | 'SELL'
): ValidationResult {
  if (side === 'BUY') {
    const cost = price * size;
    if (cost > balance) {
      return {
        valid: false,
        errors: [`Insufficient balance. Need ${cost.toFixed(2)} USDC, have ${balance.toFixed(2)}`],
      };
    }
  }

  return { valid: true, errors: [] };
}
