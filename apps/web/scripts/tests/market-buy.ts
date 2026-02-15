/**
 * Test 2: Market BUY — fills immediately at best ask + slippage.
 * Cost: ~$0.05 (min shares at low price)
 *
 * This test spends real USDC. The position can be sold back in test 4.
 */

import {
  type TestContext,
  type TargetMarket,
  type TestResult,
  findMarket,
  signAndBuildOrder,
  submitOrder,
  getPositions,
  sleep,
  log,
  pass,
  warn,
} from './setup.ts';

// Shared state: the market we bought on (used by limit-sell-cancel and market-sell)
export let boughtMarket: TargetMarket | null = null;
export let boughtSize = 0;

const SLIPPAGE_CENTS = 3;

export async function run(ctx: TestContext): Promise<TestResult> {
  const name = 'market-buy';

  try {
    // Find a binary market with liquidity on the ask side
    log(name, 'Finding liquid binary market...');
    let market: TargetMarket | null = null;
    let attempts = 0;

    // We need a market with an actual best ask
    while (!market && attempts < 3) {
      attempts++;
      const candidate = await findMarket({ negRisk: false });
      if (candidate.bestAsk && candidate.bestAsk > 0 && candidate.bestAsk < 0.95) {
        market = candidate;
      }
    }

    if (!market || !market.bestAsk) {
      return { name, passed: false, error: 'No liquid market with asks found' };
    }

    const bestAskCents = Math.round(market.bestAsk * 100);
    const limitCents = Math.min(bestAskCents + SLIPPAGE_CENTS, 99);
    // CLOB requires $1 min for marketable orders → size = max(minOrderSize, ceil(100 / limitCents))
    const minSizeForDollar = Math.ceil(100 / limitCents);
    const size = Math.max(market.minOrderSize, minSizeForDollar);

    log(name, `Market: ${market.question.substring(0, 50)}`);
    log(name, `Best ask: ${bestAskCents}c, limit: ${limitCents}c, size: ${size}`);
    log(name, `Est. cost: $${((limitCents / 100) * size).toFixed(4)}`);

    // Place market-style order (limit at ask + slippage, should fill immediately)
    const orderBody = await signAndBuildOrder(ctx, market, limitCents, size, 'BUY');
    const orderId = await submitOrder(ctx, orderBody);
    pass(`Order placed: ${orderId.substring(0, 20)}...`);

    // Verify position exists
    await sleep(3000); // Market orders need a bit more time to settle
    try {
      const positions = await getPositions(ctx);
      const hasPosition = positions.some((p) =>
        p.asset === market!.tokenId && p.size > 0
      );
      if (hasPosition) {
        pass('Position verified in portfolio');
      } else {
        warn('Position not visible yet (Data API indexing delay)');
      }
    } catch {
      warn('Could not verify position (Data API may be slow)');
    }

    // Save for subsequent tests
    boughtMarket = market;
    boughtSize = size;

    return {
      name,
      passed: true,
      details: `Bought ${size} shares at ~${limitCents}c on "${market.question.substring(0, 30)}"`,
    };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}
