/**
 * Unit tests for validateOrderParams with market constraints.
 * Functions inlined since @app/trading can't be imported in script context.
 */

import { pass, warn, type TestResult } from './setup.ts';

// Inlined from packages/trading/src/orders.ts
interface OrderParams {
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
}

interface MarketConstraints {
  tickSize?: number;
  minOrderSize?: number;
}

const DEFAULT_TICK_SIZE = 0.01;
const MIN_ORDER_SHARES = 5;

function tickSizeToCents(tickSize: number): number {
  return tickSize * 100;
}

function snapToTick(priceCents: number, tickSize: number): number {
  const tickCents = tickSizeToCents(tickSize);
  return Math.round(priceCents / tickCents) * tickCents;
}

function tickSizePriceDecimals(tickSize: number): number {
  const tickCents = tickSizeToCents(tickSize);
  if (tickCents >= 1) return 0;
  return Math.max(0, Math.ceil(-Math.log10(tickCents + 1e-15)));
}

function validateOrderParams(
  params: OrderParams,
  constraints?: MarketConstraints,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tickSize = constraints?.tickSize ?? DEFAULT_TICK_SIZE;
  const minOrderSize = constraints?.minOrderSize ?? MIN_ORDER_SHARES;
  const tickCents = tickSizeToCents(tickSize);
  const priceDecimals = tickSizePriceDecimals(tickSize);

  if (!params.tokenId) errors.push('Token ID is required');
  if (params.price < tickCents || params.price > 99) {
    errors.push(`Price must be between ${tickCents} and 99 cents`);
  } else {
    const snapped = snapToTick(params.price, tickSize);
    if (Math.abs(params.price - snapped) > 1e-9) {
      errors.push(
        priceDecimals === 0
          ? 'Price must be a whole number of cents'
          : `Price must be in ${tickCents} cent increments`
      );
    }
  }
  if (params.size <= 0) errors.push('Size must be positive');
  if (params.size < minOrderSize) errors.push(`Minimum order size is ${minOrderSize} shares`);
  const scaled = params.size * 100;
  if (Number.isFinite(scaled)) {
    const rounded = Math.round(scaled);
    if (Math.abs(scaled - rounded) > 1e-8) errors.push('Size must be in 0.01 share increments');
  }
  return { valid: errors.length === 0, errors };
}

const BASE: OrderParams = { tokenId: '0xabc', side: 'BUY', price: 50, size: 10 };

export async function run(): Promise<TestResult> {
  const name = 'validation';
  const failures: string[] = [];
  let total = 0;

  function expectValid(label: string, params: OrderParams, constraints?: MarketConstraints) {
    total++;
    const r = validateOrderParams(params, constraints);
    if (r.valid) {
      pass(label);
    } else {
      const msg = `${label}: expected valid, got errors: ${r.errors.join(', ')}`;
      warn(msg);
      failures.push(msg);
    }
  }

  function expectInvalid(label: string, params: OrderParams, constraints?: MarketConstraints, errorSubstring?: string) {
    total++;
    const r = validateOrderParams(params, constraints);
    if (!r.valid) {
      if (errorSubstring && !r.errors.some((e) => e.includes(errorSubstring))) {
        const msg = `${label}: invalid as expected but error "${errorSubstring}" not found in: ${r.errors.join(', ')}`;
        warn(msg);
        failures.push(msg);
      } else {
        pass(label);
      }
    } else {
      const msg = `${label}: expected invalid, got valid`;
      warn(msg);
      failures.push(msg);
    }
  }

  // Valid baseline
  expectValid('Valid: 50c, 10 shares', BASE);

  // Price out of range
  expectInvalid('Price too low: 0c', { ...BASE, price: 0 });
  expectInvalid('Price too high: 100c', { ...BASE, price: 100 });

  // Size below min
  expectInvalid('Size below min: 3', { ...BASE, size: 3 }, undefined, '5');

  // Fractional cent on 0.01 tick → invalid
  expectInvalid('Fractional 50.5c on 0.01 tick', { ...BASE, price: 50.5 });

  // Fractional cent on 0.001 tick → valid
  expectValid('Fractional 50.5c on 0.001 tick', { ...BASE, price: 50.5 }, { tickSize: 0.001 });

  // No tokenId
  expectInvalid('No tokenId', { ...BASE, tokenId: '' });

  // Custom min order size
  expectInvalid('Custom min=10, size=7', { ...BASE, size: 7 }, { minOrderSize: 10 }, '10');

  // Size with too many decimals
  expectInvalid('Size 5.123 (3 decimals)', { ...BASE, size: 5.123 }, undefined, '0.01');

  // Valid on 0.001 tick at 1.1c
  expectValid('1.1c on 0.001 tick', { ...BASE, price: 1.1, size: 5 }, { tickSize: 0.001 });

  // 1.15c on 0.001 tick (0.1c grid) — 1.15/0.1 = 11.5 → snaps to 1.2, not 1.15 → invalid
  expectInvalid('1.15c on 0.001 tick (off-grid)', { ...BASE, price: 1.15 }, { tickSize: 0.001 });

  return {
    name,
    passed: failures.length === 0,
    error: failures.length > 0 ? failures.join('; ') : undefined,
    details: `${total - failures.length}/${total} passed`,
  };
}
