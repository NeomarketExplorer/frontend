/**
 * Test 7: Limit order on a sub-cent tick market (minimum_tick_size=0.001).
 * Places a limit at a fractional cent price (e.g. 1.5c) to verify
 * the frontend tick-size math works end-to-end.
 * Cost: $0 (order won't fill at 1.x cents)
 */

import {
  type TestContext,
  type TestResult,
  findMarket,
  signAndBuildOrder,
  submitOrder,
  cancelOrder,
  sleep,
  log,
  pass,
  warn,
} from './setup.ts';

export async function run(ctx: TestContext): Promise<TestResult> {
  const name = 'sub-cent-tick';

  try {
    log(name, 'Finding market with 0.001 tick size...');

    let market;
    try {
      market = await findMarket({ maxTickSize: 0.005 });
    } catch {
      // Some environments might not have 0.001 tick markets available
      warn('No sub-cent tick market found — skipping');
      return { name, passed: true, details: 'Skipped (no 0.001 tick market available)' };
    }

    log(name, `Market: ${market.question.substring(0, 50)}`);
    log(name, `Tick: ${market.tickSize}`);

    // CLOB requires $1 min for marketable orders, so use enough size
    // Test 1: Place at 1.5c (fractional, valid on 0.001 tick = 0.1c grid)
    const price1 = 1.5;
    const size1 = Math.max(market.minOrderSize, Math.ceil(100 / price1));
    log(name, `Placing ${price1}c BUY x ${size1} shares (fractional price)...`);

    const orderBody1 = await signAndBuildOrder(ctx, market, price1, size1, 'BUY');
    const orderId1 = await submitOrder(ctx, orderBody1);
    pass(`Fractional price order accepted: ${orderId1.substring(0, 20)}...`);

    // Cancel it
    await cancelOrder(ctx, orderId1);
    pass('Fractional price order cancelled');

    // Test 2: Place at 2.3c (another fractional, also on 0.1c grid)
    const price2 = 2.3;
    const size2 = Math.max(market.minOrderSize, Math.ceil(100 / price2));
    log(name, `Placing ${price2}c BUY x ${size2} shares...`);

    const orderBody2 = await signAndBuildOrder(ctx, market, price2, size2, 'BUY');
    const orderId2 = await submitOrder(ctx, orderBody2);
    pass(`Second fractional price order accepted: ${orderId2.substring(0, 20)}...`);

    try {
      await cancelOrder(ctx, orderId2);
      pass('Second order cancelled');
    } catch {
      // Order may have been filled (matched) — that's fine, it still validated the sub-cent price
      warn('Second order already matched — cancel not needed');
    }

    return {
      name,
      passed: true,
      details: `Tested ${price1}c (x${size1}) and ${price2}c (x${size2}) on tick=${market.tickSize} market`,
    };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}
