'use client';

/**
 * Hook for redeeming resolved Polymarket positions.
 *
 * Two redemption paths:
 * - Standard markets: CTF redeemPositions(collateralToken, parentCollectionId, conditionId, indexSets)
 * - Neg-risk markets:  NegRiskAdapter redeemPositions(conditionId, amounts[])
 *
 * The frontend detects neg-risk from Gamma API enrichment (negRisk flag on EnrichedPosition).
 */

import { useState, useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useQueryClient } from '@tanstack/react-query';
import { createWalletClient, custom } from 'viem';
import { polygon } from 'viem/chains';
import { usePublicClient } from 'wagmi';
import { useWalletStore } from '@/stores';
import { CHAIN_CONFIG } from '@app/config';
import { positionKeys } from './use-positions';

const CTF_ADDRESS = CHAIN_CONFIG.polygon.ctf;
const USDC_ADDRESS = CHAIN_CONFIG.polygon.usdc;
const NEG_RISK_ADAPTER = CHAIN_CONFIG.polygon.negRiskAdapter;
const PARENT_COLLECTION_ID = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

const CTF_REDEEM_ABI = [{
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

const NEG_RISK_REDEEM_ABI = [{
  name: 'redeemPositions',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: '_conditionId', type: 'bytes32' },
    { name: '_amounts', type: 'uint256[]' },
  ],
  outputs: [],
}] as const;

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

interface RedeemParams {
  conditionId: string;
  negRisk: boolean;
  /** Outcome token IDs [yes, no] — required for neg-risk to read on-chain balances */
  outcomeTokenIds?: string[];
}

interface UseRedeemPositionResult {
  redeem: (params: RedeemParams) => Promise<string>;
  isPending: boolean;
  error: string | null;
  txHash: string | null;
}

export function useRedeemPosition(): UseRedeemPositionResult {
  const { address } = useWalletStore();
  const { wallets } = useWallets();
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const redeem = useCallback(async (params: RedeemParams): Promise<string> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }
    if (!publicClient) {
      throw new Error('Public client not available');
    }

    setIsPending(true);
    setError(null);
    setTxHash(null);

    try {
      // Get Privy wallet provider for TX signing
      const wallet = wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());
      if (!wallet) {
        throw new Error('Wallet not found. Please reconnect.');
      }
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: address as `0x${string}`,
        chain: polygon,
        transport: custom(provider),
      });

      // Validate and normalize conditionId to bytes32
      const conditionIdHex = params.conditionId.startsWith('0x') ? params.conditionId : `0x${params.conditionId}`;
      if (conditionIdHex.length !== 66) {
        throw new Error(`Invalid conditionId: expected 66 hex chars, got ${conditionIdHex.length}`);
      }

      let hash: `0x${string}`;

      if (params.negRisk) {
        // Neg-risk: call NegRiskAdapter.redeemPositions(conditionId, amounts[])
        // Read on-chain balances for each outcome token to get exact amounts
        const tokenIds = params.outcomeTokenIds ?? [];
        if (tokenIds.length === 0) {
          throw new Error('Outcome token IDs required for neg-risk redemption');
        }

        const amounts = await Promise.all(
          tokenIds.map((tokenId) =>
            publicClient.readContract({
              address: CTF_ADDRESS,
              abi: BALANCE_OF_ABI,
              functionName: 'balanceOf',
              args: [address as `0x${string}`, BigInt(tokenId)],
            })
          )
        );

        if (amounts.every((a) => a === 0n)) {
          throw new Error('No tokens to redeem (balance is zero)');
        }

        hash = await walletClient.writeContract({
          address: NEG_RISK_ADAPTER,
          abi: NEG_RISK_REDEEM_ABI,
          functionName: 'redeemPositions',
          args: [
            conditionIdHex as `0x${string}`,
            amounts,
          ],
        });
      } else {
        // Standard: call CTF.redeemPositions(collateralToken, parentCollectionId, conditionId, indexSets)
        hash = await walletClient.writeContract({
          address: CTF_ADDRESS,
          abi: CTF_REDEEM_ABI,
          functionName: 'redeemPositions',
          args: [
            USDC_ADDRESS,
            PARENT_COLLECTION_ID,
            conditionIdHex as `0x${string}`,
            [1n, 2n], // Binary market index sets: YES=0b01, NO=0b10
          ],
        });
      }

      setTxHash(hash);

      // Wait for TX confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      // Refresh positions and balance
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: positionKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['usdc-balance', address] }),
      ]);

      return hash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Redemption failed';
      setError(msg);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [address, publicClient, wallets, queryClient]);

  return {
    redeem,
    isPending,
    error,
    txHash,
  };
}
