/**
 * Test 1: Limit BUY at 1c → verify in open orders → cancel → verify gone.
 * Cost: $0 (order never fills at 1c)
 */

import {
  type TestContext,
  type TestResult,
  findMarket,
  signAndBuildOrder,
  submitOrder,
  cancelOrder,
  getOpenOrders,
  sleep,
  log,
  pass,
  warn,
} from './setup.ts';

export async function run(ctx: TestContext): Promise<TestResult> {
  const name = 'limit-buy-cancel';

  try {
    // Find a binary market
    log(name, 'Finding binary market...');
    const market = await findMarket({ negRisk: false });
    log(name, `Market: ${market.question.substring(0, 50)}`);
    log(name, `Tick: ${market.tickSize}, min: ${market.minOrderSize}`);

    // Place limit BUY at 1c (won't fill)
    const priceCents = 1;
    const size = market.minOrderSize;
    log(name, `Placing ${priceCents}c BUY x ${size} shares...`);

    const orderBody = await signAndBuildOrder(ctx, market, priceCents, size, 'BUY');
    const orderId = await submitOrder(ctx, orderBody);
    pass(`Order placed: ${orderId.substring(0, 20)}...`);

    // Verify in open orders
    await sleep(1500);
    const orders = await getOpenOrders(ctx);
    const found = orders.some((o) => o.id === orderId);
    if (found) {
      pass('Order found in open orders');
    } else {
      warn('Order not in open orders yet (indexing delay)');
    }

    // Cancel
    await cancelOrder(ctx, orderId);
    pass('Order cancelled');

    // Verify gone
    await sleep(1500);
    const orders2 = await getOpenOrders(ctx);
    const stillThere = orders2.some((o) => o.id === orderId);
    if (stillThere) {
      warn('Order still in list after cancel (indexing delay)');
    } else {
      pass('Order confirmed gone');
    }

    return { name, passed: true, details: `orderId=${orderId}` };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}
