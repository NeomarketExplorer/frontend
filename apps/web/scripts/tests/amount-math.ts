/**
 * Unit tests for calculateAmounts (order amount BigInt math).
 */

import { pass, warn, calculateAmounts, type TestResult } from './setup.ts';

export async function run(): Promise<TestResult> {
  const name = 'amount-math';
  const failures: string[] = [];
  let total = 0;

  function check(
    label: string,
    actual: { makerAmount: string; takerAmount: string },
    expected: { makerAmount: string; takerAmount: string },
  ) {
    total++;
    if (actual.makerAmount === expected.makerAmount && actual.takerAmount === expected.takerAmount) {
      pass(label);
    } else {
      const msg = `${label}: expected maker=${expected.makerAmount} taker=${expected.takerAmount}, got maker=${actual.makerAmount} taker=${actual.takerAmount}`;
      warn(msg);
      failures.push(msg);
    }
  }

  // BUY 50c x 10 shares
  // sharesInt=1000, priceTenths=500, usdc=500*1000*10=5000000, shares=1000*10000=10000000
  check('BUY 50c x 10 shares', calculateAmounts(50, 10, 'BUY'), {
    makerAmount: '5000000', takerAmount: '10000000',
  });

  // BUY 1c x 5 shares
  // sharesInt=500, priceTenths=10, usdc=10*500*10=50000, shares=500*10000=5000000
  check('BUY 1c x 5 shares', calculateAmounts(1, 5, 'BUY'), {
    makerAmount: '50000', takerAmount: '5000000',
  });

  // SELL 99c x 5 shares (maker=shares, taker=usdc)
  // priceTenths=990, usdc=990*500*10=4950000
  check('SELL 99c x 5 shares', calculateAmounts(99, 5, 'SELL'), {
    makerAmount: '5000000', takerAmount: '4950000',
  });

  // BUY 50.5c (fractional) x 5 shares
  // priceTenths=505, usdc=505*500*10=2525000
  check('BUY 50.5c x 5 (fractional price)', calculateAmounts(50.5, 5, 'BUY'), {
    makerAmount: '2525000', takerAmount: '5000000',
  });

  // BUY 1c x 0.01 shares (minimum)
  // sharesInt=1, priceTenths=10, usdc=10*1*10=100, shares=1*10000=10000
  check('BUY 1c x 0.01 shares (min)', calculateAmounts(1, 0.01, 'BUY'), {
    makerAmount: '100', takerAmount: '10000',
  });

  // BUY and SELL swap maker/taker
  total++;
  const buy = calculateAmounts(65, 8, 'BUY');
  const sell = calculateAmounts(65, 8, 'SELL');
  if (buy.makerAmount === sell.takerAmount && buy.takerAmount === sell.makerAmount) {
    pass('BUY/SELL swap maker/taker (65c x 8)');
  } else {
    const msg = 'BUY/SELL do not swap maker/taker correctly';
    warn(msg);
    failures.push(msg);
  }

  return {
    name,
    passed: failures.length === 0,
    error: failures.length > 0 ? failures.join('; ') : undefined,
    details: `${total - failures.length}/${total} passed`,
  };
}
