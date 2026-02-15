/**
 * Test 5: Limit BUY on a neg_risk (multi-outcome) market → verify → cancel.
 * Validates that the NegRiskCTFExchange EIP-712 domain is used correctly.
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
  const name = 'neg-risk-limit';

  try {
    log(name, 'Finding neg_risk market...');
    const market = await findMarket({ negRisk: true });
    log(name, `Market: ${market.question.substring(0, 50)}`);
    log(name, `Tick: ${market.tickSize}, min: ${market.minOrderSize}, negRisk: true`);

    const priceCents = 1;
    const size = market.minOrderSize;
    log(name, `Placing ${priceCents}c BUY x ${size} shares (NegRiskCTFExchange)...`);

    const orderBody = await signAndBuildOrder(ctx, market, priceCents, size, 'BUY');
    const orderId = await submitOrder(ctx, orderBody);
    pass(`Order placed: ${orderId.substring(0, 20)}...`);

    // Verify
    await sleep(1500);
    const orders = await getOpenOrders(ctx);
    const found = orders.some((o) => o.id === orderId);
    if (found) {
      pass('Neg-risk order found in open orders');
    } else {
      warn('Order not in open orders yet');
    }

    // Cancel
    await cancelOrder(ctx, orderId);
    pass('Neg-risk order cancelled');

    return { name, passed: true, details: `orderId=${orderId}` };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}
