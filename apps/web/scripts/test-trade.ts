#!/usr/bin/env npx tsx
/**
 * Trade Smoke Test Suite — comprehensive testing of order flow.
 *
 * Usage:
 *   pnpm test:trade                   # Run all tests
 *   pnpm test:trade -- --test 1       # Run just test 1
 *   pnpm test:trade -- --test 1,2,3   # Run specific tests
 *   pnpm test:trade -- --unit         # Run only unit tests (no network)
 *   pnpm test:trade -- --e2e          # Run only E2E tests (places real orders)
 *   pnpm test:trade -- --dry-run      # Auth check only, no orders
 *
 * Requires: apps/web/.env.test.local with TEST_PRIVATE_KEY=0x...
 */

import { setupTestContext, cleanupPositions, type TestContext, type TestResult } from './tests/setup.ts';

// Unit tests (no network, no wallet needed)
import { run as amountMath } from './tests/amount-math.ts';
import { run as tickHelpers } from './tests/tick-helpers.ts';
import { run as validation } from './tests/validation.ts';

// E2E tests (real CLOB orders, needs wallet + USDC)
import { run as limitBuyCancel } from './tests/limit-buy-cancel.ts';
import { run as marketBuy } from './tests/market-buy.ts';
import { run as limitSellCancel } from './tests/limit-sell-cancel.ts';
import { run as marketSell } from './tests/market-sell.ts';
import { run as negRiskLimit } from './tests/neg-risk-limit.ts';
import { run as negRiskRoundTrip } from './tests/neg-risk-round-trip.ts';
import { run as subCentTick } from './tests/sub-cent-tick.ts';
import { run as buyKeepers } from './tests/buy-keepers.ts';
import { run as redeemKeepers } from './tests/redeem-keepers.ts';

interface TestEntry {
  id: number;
  name: string;
  type: 'unit' | 'e2e';
  run: (ctx: TestContext) => Promise<TestResult>;
}

// Wrap unit tests to accept (but ignore) ctx
function wrapUnit(fn: () => Promise<TestResult>): (ctx: TestContext) => Promise<TestResult> {
  return () => fn();
}

const ALL_TESTS: TestEntry[] = [
  // Unit tests (1-3)
  { id: 1, name: 'amount-math', type: 'unit', run: wrapUnit(amountMath) },
  { id: 2, name: 'tick-helpers', type: 'unit', run: wrapUnit(tickHelpers) },
  { id: 3, name: 'validation', type: 'unit', run: wrapUnit(validation) },

  // E2E tests (4-10)
  { id: 4, name: 'limit-buy-cancel', type: 'e2e', run: limitBuyCancel },
  { id: 5, name: 'market-buy', type: 'e2e', run: marketBuy },
  { id: 6, name: 'limit-sell-cancel', type: 'e2e', run: limitSellCancel },
  { id: 7, name: 'market-sell', type: 'e2e', run: marketSell },
  { id: 8, name: 'neg-risk-limit', type: 'e2e', run: negRiskLimit },
  { id: 9, name: 'neg-risk-round-trip', type: 'e2e', run: negRiskRoundTrip },
  { id: 10, name: 'sub-cent-tick', type: 'e2e', run: subCentTick },
  { id: 11, name: 'buy-keepers', type: 'e2e', run: buyKeepers },
  { id: 12, name: 'redeem-keepers', type: 'e2e', run: redeemKeepers },
];

function parseArgs(): { testIds: number[] | null; unitOnly: boolean; e2eOnly: boolean; dryRun: boolean } {
  const args = process.argv.slice(2);
  let testIds: number[] | null = null;
  let unitOnly = false;
  let e2eOnly = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--test' && args[i + 1]) {
      testIds = args[i + 1].split(',').map(Number).filter((n) => !isNaN(n));
      i++;
    } else if (args[i] === '--unit') {
      unitOnly = true;
    } else if (args[i] === '--e2e') {
      e2eOnly = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { testIds, unitOnly, e2eOnly, dryRun };
}

async function main() {
  const { testIds, unitOnly, e2eOnly, dryRun } = parseArgs();

  console.log('\n\x1b[1m🔧 Neomarket Trade Test Suite\x1b[0m\n');

  // Filter tests
  let tests = ALL_TESTS;
  if (testIds) {
    tests = tests.filter((t) => testIds.includes(t.id));
  } else if (unitOnly) {
    tests = tests.filter((t) => t.type === 'unit');
  } else if (e2eOnly) {
    tests = tests.filter((t) => t.type === 'e2e');
  }

  if (tests.length === 0) {
    console.log('No tests matched. Available tests:');
    ALL_TESTS.forEach((t) => console.log(`  ${t.id}. [${t.type}] ${t.name}`));
    process.exit(1);
  }

  console.log(`Running ${tests.length} test(s):`);
  tests.forEach((t) => console.log(`  ${t.id}. [${t.type}] ${t.name}`));
  console.log('');

  // Setup context (needed for E2E, skippable for unit-only)
  const needsE2E = tests.some((t) => t.type === 'e2e');
  let ctx: TestContext | null = null;

  if (needsE2E) {
    console.log('── Setup ──────────────────────────────────────');
    ctx = await setupTestContext();
    console.log('');

    if (dryRun) {
      console.log('\x1b[32m✅ Dry run: auth successful, no orders placed.\x1b[0m\n');
      process.exit(0);
    }
  }

  // Run tests sequentially (E2E tests have dependencies)
  const results: TestResult[] = [];

  for (const test of tests) {
    console.log(`── Test ${test.id}: ${test.name} ──────────────────────────────────────`);
    const result = await test.run(ctx!);
    results.push(result);

    const icon = result.passed ? '\x1b[32m✓' : '\x1b[31m✗';
    console.log(`${icon} ${result.name}\x1b[0m ${result.details ? `(${result.details})` : ''}`);
    if (result.error) {
      console.log(`  \x1b[31mError: ${result.error}\x1b[0m`);
    }
    console.log('');
  }

  // Cleanup: sell any positions left open by tests
  if (ctx) {
    console.log('── Cleanup ──────────────────────────────────────');
    // Wait a bit for Data API to index any recent trades
    await new Promise((r) => setTimeout(r, 3000));
    const cleanup = await cleanupPositions(ctx);
    if (cleanup.sold > 0 || cleanup.failed > 0 || cleanup.kept > 0) {
      const parts = [];
      if (cleanup.sold > 0) parts.push(`closed ${cleanup.sold}`);
      if (cleanup.kept > 0) parts.push(`kept ${cleanup.kept} (redemption)`);
      if (cleanup.failed > 0) parts.push(`${cleanup.failed} failed`);
      console.log(`  ${parts.join(', ')}`);
    }
    console.log('');
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log('═══════════════════════════════════════════════');
  if (failed === 0) {
    console.log(`\x1b[32m✅ All ${total} tests passed!\x1b[0m`);
  } else {
    console.log(`\x1b[31m❌ ${failed}/${total} tests failed:\x1b[0m`);
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  \x1b[31m✗ ${r.name}: ${r.error}\x1b[0m`);
    });
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n\x1b[31m❌ Test suite crashed:\x1b[0m', err.message || err);
  process.exit(1);
});
