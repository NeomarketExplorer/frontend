'use client';

/**
 * Hook for redeeming resolved Polymarket positions via CTF redeemPositions().
 * Burns outcome tokens and pays out USDC for winning positions.
 *
 * Uses the same wallet pattern as use-conditional-token-approval.ts:
 * Privy useWallets → getEthereumProvider → viem walletClient.writeContract
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
const PARENT_COLLECTION_ID = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

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

interface UseRedeemPositionResult {
  redeem: (conditionId: string) => Promise<string>;
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

  const redeem = useCallback(async (conditionId: string): Promise<string> => {
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
      const conditionIdHex = conditionId.startsWith('0x') ? conditionId : `0x${conditionId}`;
      if (conditionIdHex.length !== 66) {
        throw new Error(`Invalid conditionId: expected 66 hex chars, got ${conditionIdHex.length}`);
      }

      const hash = await walletClient.writeContract({
        address: CTF_ADDRESS,
        abi: REDEEM_POSITIONS_ABI,
        functionName: 'redeemPositions',
        args: [
          USDC_ADDRESS,
          PARENT_COLLECTION_ID,
          conditionIdHex as `0x${string}`,
          [1n, 2n], // Binary market index sets: YES=0b01, NO=0b10
        ],
      });

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
