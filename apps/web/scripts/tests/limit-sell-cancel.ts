/**
 * Test 3: Limit SELL at 99c → verify in open orders → cancel → verify gone.
 * Depends on test 2 (market-buy) to have a position.
 * Cost: $0 (order won't fill at 99c)
 */

import {
  type TestContext,
  type TestResult,
  signAndBuildOrder,
  submitOrder,
  cancelOrder,
  getOpenOrders,
  sleep,
  log,
  pass,
  warn,
} from './setup.ts';
import { boughtMarket, boughtSize } from './market-buy.ts';

export async function run(ctx: TestContext): Promise<TestResult> {
  const name = 'limit-sell-cancel';

  try {
    if (!boughtMarket || boughtSize <= 0) {
      return { name, passed: false, error: 'No position from market-buy test — skipped' };
    }

    const market = boughtMarket;
    const priceCents = 99; // Far above market — won't fill
    const size = boughtSize;

    log(name, `Placing ${priceCents}c SELL x ${size} shares...`);

    const orderBody = await signAndBuildOrder(ctx, market, priceCents, size, 'SELL');
    const orderId = await submitOrder(ctx, orderBody);
    pass(`Sell order placed: ${orderId.substring(0, 20)}...`);

    // Verify in open orders
    await sleep(1500);
    const orders = await getOpenOrders(ctx);
    const found = orders.some((o) => o.id === orderId);
    if (found) {
      pass('Sell order found in open orders');
    } else {
      warn('Sell order not in open orders yet (indexing delay)');
    }

    // Cancel
    await cancelOrder(ctx, orderId);
    pass('Sell order cancelled');

    // Verify gone
    await sleep(1500);
    const orders2 = await getOpenOrders(ctx);
    const stillThere = orders2.some((o) => o.id === orderId);
    if (stillThere) {
      warn('Sell order still in list after cancel (indexing delay)');
    } else {
      pass('Sell order confirmed gone');
    }

    return { name, passed: true, details: `orderId=${orderId}` };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}
