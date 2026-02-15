/**
 * Unit tests for tick size helper functions.
 * Functions are inlined since @app/trading can't be imported in this script context.
 */

import { pass, warn, type TestResult } from './setup.ts';

// Inlined from packages/trading/src/orders.ts
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

export async function run(): Promise<TestResult> {
  const name = 'tick-helpers';
  const failures: string[] = [];
  let total = 0;

  function check(label: string, actual: number, expected: number) {
    total++;
    if (Math.abs(actual - expected) < 1e-9) {
      pass(label);
    } else {
      const msg = `${label}: expected ${expected}, got ${actual}`;
      warn(msg);
      failures.push(msg);
    }
  }

  // tickSizeToCents
  check('tickSizeToCents(0.01) = 1', tickSizeToCents(0.01), 1);
  check('tickSizeToCents(0.001) = 0.1', tickSizeToCents(0.001), 0.1);

  // snapToTick with 0.01 tick (1c grid)
  check('snapToTick(50, 0.01) = 50', snapToTick(50, 0.01), 50);
  check('snapToTick(50.3, 0.01) = 50', snapToTick(50.3, 0.01), 50);
  check('snapToTick(50.5, 0.01) = 51', snapToTick(50.5, 0.01), 51); // Math.round(50.5) = 51

  // snapToTick with 0.001 tick (0.1c grid)
  check('snapToTick(50.3, 0.001) = 50.3', snapToTick(50.3, 0.001), 50.3);
  check('snapToTick(50.35, 0.001) = 50.4', snapToTick(50.35, 0.001), 50.4);
  check('snapToTick(1.5, 0.001) = 1.5', snapToTick(1.5, 0.001), 1.5);
  check('snapToTick(1.54, 0.001) = 1.5', snapToTick(1.54, 0.001), 1.5);
  check('snapToTick(1.56, 0.001) = 1.6', snapToTick(1.56, 0.001), 1.6);

  // tickSizePriceDecimals
  check('tickSizePriceDecimals(0.01) = 0', tickSizePriceDecimals(0.01), 0);
  check('tickSizePriceDecimals(0.001) = 1', tickSizePriceDecimals(0.001), 1);

  return {
    name,
    passed: failures.length === 0,
    error: failures.length > 0 ? failures.join('; ') : undefined,
    details: `${total - failures.length}/${total} passed`,
  };
}
