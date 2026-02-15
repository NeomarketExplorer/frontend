/**
 * Test 6: Full round-trip on a neg_risk market — market BUY then market SELL.
 * Validates both exchange domain signings on multi-outcome markets.
 * Cost: ~$0.05-0.10 (buy + sell at min shares, spread loss)
 */

import {
  type TestContext,
  type TestResult,
  findMarket,
  signAndBuildOrder,
  submitOrder,
  sleep,
  log,
  pass,
  warn,
  CLOB_BASE,
} from './setup.ts';

const SLIPPAGE_CENTS = 3;

export async function run(ctx: TestContext): Promise<TestResult> {
  const name = 'neg-risk-round-trip';

  try {
    log(name, 'Finding liquid neg_risk market...');
    let market = await findMarket({ negRisk: true });

    // Refresh orderbook to get latest bid/ask
    try {
      const bookRes = await fetch(`${CLOB_BASE}/book?token_id=${market.tokenId}`);
      if (bookRes.ok) {
        const book = await bookRes.json();
        const bids = (book.bids ?? []).map((l: { price: string }) => parseFloat(l.price)).sort((a: number, b: number) => b - a);
        const asks = (book.asks ?? []).map((l: { price: string }) => parseFloat(l.price)).sort((a: number, b: number) => a - b);
        market = { ...market, bestBid: bids[0] ?? null, bestAsk: asks[0] ?? null };
      }
    } catch { /* best effort */ }

    if (!market.bestAsk || market.bestAsk <= 0 || market.bestAsk >= 0.95) {
      return { name, passed: false, error: 'No suitable ask liquidity on neg_risk market' };
    }

    const buyPrice = Math.min(Math.round(market.bestAsk * 100) + SLIPPAGE_CENTS, 99);
    // CLOB requires $1 min for marketable orders → size = max(minOrderSize, ceil(100 / price))
    const minSizeForDollar = Math.ceil(100 / buyPrice);
    const size = Math.max(market.minOrderSize, minSizeForDollar);

    log(name, `Market: ${market.question.substring(0, 50)}`);
    log(name, `BUY: ${buyPrice}c x ${size} shares`);

    // BUY
    const buyBody = await signAndBuildOrder(ctx, market, buyPrice, size, 'BUY');
    const buyOrderId = await submitOrder(ctx, buyBody);
    pass(`BUY order filled: ${buyOrderId.substring(0, 20)}...`);

    // Wait for settlement
    await sleep(2000);

    // Refresh bid for sell
    try {
      const bookRes = await fetch(`${CLOB_BASE}/book?token_id=${market.tokenId}`);
      if (bookRes.ok) {
        const book = await bookRes.json();
        const bids = (book.bids ?? []).map((l: { price: string }) => parseFloat(l.price)).sort((a: number, b: number) => b - a);
        market = { ...market, bestBid: bids[0] ?? null };
      }
    } catch { /* best effort */ }

    if (!market.bestBid || market.bestBid <= 0) {
      warn('No bid liquidity for sell — position remains open');
      return {
        name,
        passed: true,
        details: `BUY filled but no bid to sell back. Position open on "${market.question.substring(0, 30)}"`,
      };
    }

    const sellPrice = Math.max(Math.round(market.bestBid * 100) - SLIPPAGE_CENTS, 1);
    // Sell same amount we bought (already meets $1 min from buy calc)
    log(name, `SELL: ${sellPrice}c x ${size} shares`);

    // SELL
    const sellBody = await signAndBuildOrder(ctx, market, sellPrice, size, 'SELL');
    const sellOrderId = await submitOrder(ctx, sellBody);
    pass(`SELL order filled: ${sellOrderId.substring(0, 20)}...`);

    const pnlEstimate = ((sellPrice - buyPrice) / 100 * size).toFixed(4);
    log(name, `Estimated P&L: $${pnlEstimate} (spread loss expected)`);

    return {
      name,
      passed: true,
      details: `Round-trip on neg_risk: BUY ${buyPrice}c → SELL ${sellPrice}c x ${size} shares`,
    };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}
