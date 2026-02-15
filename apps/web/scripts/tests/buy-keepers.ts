/**
 * Test 11: Buy keeper positions — near-certain outcomes for redemption testing.
 *
 * Finds markets with YES price >= 95c (highly likely to resolve YES),
 * buys small positions, and saves them to .keepers.json so cleanup won't sell them.
 * When these markets resolve, we test redeemPositions() (Sprint 7.2).
 *
 * Cost: ~$1 per keeper (buying at 95-99c, get $1 back on resolution).
 * Net cost is only the spread — effectively free if the outcome resolves YES.
 */

import {
  type TestContext,
  type TestResult,
  CLOB_BASE,
  GAMMA_BASE,
  signAndBuildOrder,
  submitOrder,
  addKeeper,
  loadKeepers,
  log,
  pass,
  warn,
  sleep,
  type TargetMarket,
} from './setup.ts';

const TARGET_KEEPERS = 3; // How many keeper positions to hold
const MIN_YES_PRICE = 0.93; // Buy outcomes priced >= 93c
const MAX_YES_PRICE = 0.99; // But not 99c+ (already resolved / no ask liquidity)

export async function run(ctx: TestContext): Promise<TestResult> {
  const name = 'buy-keepers';

  try {
    const existing = loadKeepers();
    const needed = TARGET_KEEPERS - existing.length;

    if (needed <= 0) {
      log(name, `Already have ${existing.length} keeper(s):`);
      existing.forEach((k) => log(name, `  ${k.question.substring(0, 50)} — ${k.size} shares @ ${k.price}c`));
      return { name, passed: true, details: `${existing.length} keepers already held` };
    }

    log(name, `Need ${needed} more keeper(s) (have ${existing.length}/${TARGET_KEEPERS})`);

    // Search for high-probability markets
    const existingTokenIds = new Set(existing.map((k) => k.tokenId));
    let bought = 0;

    // Fetch multiple pages of events to find suitable markets
    for (let page = 0; page < 5 && bought < needed; page++) {
      const offset = page * 20;
      const eventsRes = await fetch(`${GAMMA_BASE}/events?limit=20&offset=${offset}&active=true&closed=false`);
      if (!eventsRes.ok) continue;
      const events = await eventsRes.json();

      for (const event of events) {
        if (bought >= needed) break;

        for (const market of event.markets ?? []) {
          if (bought >= needed) break;
          const cid = market.conditionId;
          if (!cid) continue;

          // Check CLOB market status
          let cm;
          try {
            const clobRes = await fetch(`${CLOB_BASE}/markets/${cid}`);
            if (!clobRes.ok) continue;
            cm = await clobRes.json();
          } catch { continue; }

          if (!cm.accepting_orders || cm.closed) continue;

          const firstToken = cm.tokens?.[0];
          if (!firstToken?.token_id) continue;
          if (existingTokenIds.has(firstToken.token_id)) continue;

          const negRisk = cm.neg_risk ?? false;
          const tickSize = cm.minimum_tick_size ?? 0.01;
          const minOrderSize = cm.minimum_order_size ?? 5;

          // Check orderbook for high YES price
          let bestAsk: number | null = null;
          try {
            const bookRes = await fetch(`${CLOB_BASE}/book?token_id=${firstToken.token_id}`);
            if (!bookRes.ok) continue;
            const book = await bookRes.json();
            const asks = (book.asks ?? [])
              .map((l: { price: string }) => parseFloat(l.price))
              .sort((a: number, b: number) => a - b);
            bestAsk = asks[0] ?? null;
          } catch { continue; }

          if (!bestAsk || bestAsk < MIN_YES_PRICE || bestAsk > MAX_YES_PRICE) continue;

          // Found a near-certain market — buy minimum shares
          const askCents = Math.round(bestAsk * 100);
          const limitCents = Math.min(askCents + 1, 99); // 1c slippage
          // Use exact CLOB minimum — at 93c+ the $1 floor is always met with min shares
          const size = minOrderSize;
          const question = cm.question || market.question || '?';

          log(name, `Buying keeper: "${question.substring(0, 50)}"`);
          log(name, `  YES @ ${askCents}c, buying ${size} shares (~$${((limitCents / 100) * size).toFixed(2)})`);

          try {
            const targetMarket: TargetMarket = {
              conditionId: cid,
              tokenId: firstToken.token_id,
              question,
              negRisk,
              tickSize,
              minOrderSize,
              bestBid: null,
              bestAsk,
            };

            const orderBody = await signAndBuildOrder(ctx, targetMarket, limitCents, size, 'BUY');
            await submitOrder(ctx, orderBody);

            addKeeper({
              tokenId: firstToken.token_id,
              conditionId: cid,
              question,
              size,
              price: limitCents,
              boughtAt: new Date().toISOString(),
            });

            pass(`Keeper bought: ${size} shares @ ${limitCents}c`);
            bought++;
            existingTokenIds.add(firstToken.token_id);
            await sleep(500);
          } catch (err: any) {
            warn(`Failed to buy keeper: ${err.message}`);
          }
        }
      }
    }

    const total = loadKeepers();
    return {
      name,
      passed: true,
      details: `${bought} new keeper(s) bought, ${total.length} total held`,
    };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}
