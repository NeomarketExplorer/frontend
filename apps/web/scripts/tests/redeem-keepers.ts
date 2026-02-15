/**
 * Test 12: Redeem keeper positions — claim USDC from resolved markets.
 *
 * For each keeper in .keepers.json:
 * 1. Checks if the market has resolved via CLOB API
 * 2. Checks on-chain CTF balance (must hold tokens)
 * 3. Calls redeemPositions() to burn tokens and receive USDC
 * 4. Verifies token balance is now 0
 * 5. Removes redeemed keeper from .keepers.json
 */

import { createPublicClient, http, type Hex } from 'viem';
import { polygon } from 'viem/chains';
import {
  type TestContext,
  type TestResult,
  CLOB_BASE,
  loadKeepers,
  saveKeepers,
  log,
  pass,
  warn,
  sleep,
} from './setup.ts';

const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as Hex;
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as Hex;
const PARENT_COLLECTION_ID = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;

const BALANCE_OF_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'account', type: 'address' },
    { name: 'id', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

const REDEEM_POSITIONS_ABI = [{
  name: 'redeemPositions',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'collateralToken', type: 'address' },
    { name: 'parentCollectionId', type: 'bytes32' },
    { name: 'conditionId', type: 'bytes32' },
    { name: 'indexSets', type: 'uint256[]' },
  ],
  outputs: [],
}] as const;

export async function run(ctx: TestContext): Promise<TestResult> {
  const name = 'redeem-keepers';

  try {
    const keepers = loadKeepers();

    if (keepers.length === 0) {
      log(name, 'No keeper positions found. Run test 11 (buy-keepers) first.');
      return { name, passed: true, details: 'No keepers to redeem' };
    }

    log(name, `Found ${keepers.length} keeper(s) to check`);

    const publicClient = createPublicClient({
      chain: polygon,
      transport: http('https://polygon-rpc.com'),
    });

    let redeemed = 0;
    let notResolved = 0;
    let failed = 0;
    const remainingKeepers = [...keepers];

    for (const keeper of keepers) {
      log(name, `Checking: "${keeper.question.substring(0, 50)}"`);

      // 1. Check if market is resolved via CLOB
      let isResolved = false;
      try {
        const clobRes = await fetch(`${CLOB_BASE}/markets/${keeper.conditionId}`);
        if (clobRes.ok) {
          const cm = await clobRes.json();
          isResolved = cm.closed === true;
        }
      } catch {
        warn(`Could not fetch CLOB status for ${keeper.conditionId.slice(0, 16)}...`);
      }

      if (!isResolved) {
        log(name, `  Market not yet resolved — skipping`);
        notResolved++;
        continue;
      }

      log(name, `  Market resolved! Checking on-chain balance...`);

      // 2. Check on-chain balance
      const balance = await publicClient.readContract({
        address: CTF_ADDRESS,
        abi: BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [ctx.address as Hex, BigInt(keeper.tokenId)],
      });

      if (balance === 0n) {
        log(name, `  Already redeemed (balance = 0) — removing from keepers`);
        const idx = remainingKeepers.findIndex((k) => k.tokenId === keeper.tokenId);
        if (idx !== -1) remainingKeepers.splice(idx, 1);
        redeemed++;
        continue;
      }

      log(name, `  Balance: ${balance.toString()} tokens. Redeeming...`);

      // 3. Call redeemPositions
      try {
        const hash = await ctx.walletClient.writeContract({
          address: CTF_ADDRESS,
          abi: REDEEM_POSITIONS_ABI,
          functionName: 'redeemPositions',
          args: [
            USDC_ADDRESS,
            PARENT_COLLECTION_ID,
            keeper.conditionId as Hex,
            [1n, 2n],
          ],
        });

        log(name, `  TX submitted: ${hash}`);

        // 4. Wait for receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
          throw new Error(`TX reverted: ${hash}`);
        }

        // 5. Verify balance is now 0
        const newBalance = await publicClient.readContract({
          address: CTF_ADDRESS,
          abi: BALANCE_OF_ABI,
          functionName: 'balanceOf',
          args: [ctx.address as Hex, BigInt(keeper.tokenId)],
        });

        if (newBalance > 0n) {
          warn(`Balance still ${newBalance} after redemption — may need another call`);
        }

        // 6. Remove from keepers
        const idx = remainingKeepers.findIndex((k) => k.tokenId === keeper.tokenId);
        if (idx !== -1) remainingKeepers.splice(idx, 1);

        const payout = Number(balance) / 1_000_000; // CTF outcome tokens use 6 decimals (same as USDC)
        pass(`Redeemed: ${keeper.question.substring(0, 40)}... — payout ~$${payout.toFixed(2)}`);
        redeemed++;
        await sleep(500);
      } catch (err: any) {
        warn(`Failed to redeem: ${err.message}`);
        failed++;
      }
    }

    // 7. Save updated keepers
    saveKeepers(remainingKeepers);

    const details = [
      redeemed > 0 ? `${redeemed} redeemed` : null,
      notResolved > 0 ? `${notResolved} not resolved` : null,
      failed > 0 ? `${failed} failed` : null,
    ].filter(Boolean).join(', ');

    return {
      name,
      passed: failed === 0,
      details: details || 'No action taken',
      error: failed > 0 ? `${failed} redemption(s) failed` : undefined,
    };
  } catch (err: any) {
    return { name, passed: false, error: err.message };
  }
}
