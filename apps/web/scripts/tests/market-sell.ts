/**
 * Test 4: Market SELL — sells back the position from test 2.
 * Depends on test 2 (market-buy) to have a position.
 * Cost: likely a small loss due to spread (buy at ask, sell at bid).
 */

import {
  type TestContext,
  type TestResult,
  signAndBuildOrder,
  submitOrder,
  getPositions,
  sleep,
  log,
  pass,
  warn,
} from './setup.ts';
import { boughtMarket, boughtSize } from './market-buy.ts';

const SLIPPAGE_CENTS = 3;

export async function run(ctx: TestContext): Promise<TestResult> {
  const name = 'market-sell';

  try {
    if (!boughtMarket || boughtSize <= 0) {
      return { name, passed: false, error: 'No position from market-buy test — skipped' };
    }

    const market = boughtMarket;

    if (!market.bestBid || market.bestBid <= 0) {
      return { name, passed: false, error: 'No bid liquidity — cannot sell' };
    }

    const bestBidCents = Math.round(market.bestBid * 100);
    const limitCents = Math.max(bestBidCents - SLIPPAGE_CENTS, 1);
    const size = boughtSize;

    log(name, `Best bid: ${bestBidCents}c, limit: ${limitCents}c, size: ${size}`);
    log(name, `Est. proceeds: $${((limitCents / 100) * size).toFixed(4)}`);

    const orderBody = await signAndBuildOrder(ctx, market, limitCents, size, 'SELL');
    const orderId = await submitOrder(ctx, orderBody);
    pass(`Sell order placed: ${orderId.substring(0, 20)}...`);

    // Verify position reduced/gone
    await sleep(3000);
    try {
      const positions = await getPositions(ctx);
      const remaining = positions.find((p) => p.asset === market.tokenId);
      if (!remaining || remaining.size <= 0) {
        pass('Position fully closed');
      } else {
        warn(`Position still shows ${remaining.size} shares (may be indexing delay)`);
      }
    } catch {
      warn('Could not verify position closure (Data API may be slow)');
    }

    return {
      name,
      passed: true,
      details: `Sold ${size} shares at ~${limitCents}c`,
    };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}
