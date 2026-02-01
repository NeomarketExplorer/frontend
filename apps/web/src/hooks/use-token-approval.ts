'use client';

/**
 * Hook for approving USDC spend on all Polymarket exchange contracts.
 * Sends approve(spender, maxUint256) TX via wallet provider.
 *
 * Always approves USDC for all 4 contracts:
 * - CTF (Conditional Token Framework)
 * - CTF Exchange
 * - NegRisk CTF Exchange
 * - NegRisk Adapter
 *
 * Checks existing allowances first to skip already-approved contracts.
 * Waits for each TX receipt before proceeding to the next.
 */

import { useState, useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useWalletStore } from '@/stores';
import { useQueryClient } from '@tanstack/react-query';
import { createPublicClient, createWalletClient, custom, http, erc20Abi, formatUnits, maxUint256 } from 'viem';
import { polygon } from 'viem/chains';
import { CHAIN_CONFIG } from '@app/config';

const USDC_ADDRESS = CHAIN_CONFIG.polygon.usdc;
const POLYGON_RPC_URL = CHAIN_CONFIG.polygon.rpcUrl;

// Threshold: consider "approved" if allowance > 1M USDC (effectively unlimited)
const APPROVAL_THRESHOLD = 1_000_000;

// All 4 spenders that need USDC approval
const ALL_SPENDERS = [
  CHAIN_CONFIG.polygon.ctf,
  CHAIN_CONFIG.polygon.ctfExchange,
  CHAIN_CONFIG.polygon.negRiskCtfExchange,
  CHAIN_CONFIG.polygon.negRiskAdapter,
];

let publicClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: polygon,
      transport: http(POLYGON_RPC_URL),
    });
  }
  return publicClient;
}

interface UseTokenApprovalResult {
  approve: () => Promise<string | null>;
  isApproving: boolean;
  error: string | null;
  txHash: string | null;
}

/**
 * Returns a function to approve USDC for all required exchange contracts.
 * Checks on-chain allowances first and only sends TXs for contracts that need it.
 * Waits for each TX receipt before sending the next.
 */
export function useTokenApproval(_negRisk = false): UseTokenApprovalResult {
  const { wallets } = useWallets();
  const { address } = useWalletStore();
  const queryClient = useQueryClient();
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const approve = useCallback(async (): Promise<string | null> => {
    if (!address) {
      setError('Wallet not connected');
      return null;
    }

    const wallet = wallets.find(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );
    if (!wallet) {
      setError('Wallet not found');
      return null;
    }

    setIsApproving(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = await wallet.getEthereumProvider();
      const client = getPublicClient();

      const walletClient = createWalletClient({
        account: address as `0x${string}`,
        chain: polygon,
        transport: custom(provider),
      });

      // Check existing allowances for all spenders
      const allowances = await Promise.all(
        ALL_SPENDERS.map((spender) =>
          client.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address as `0x${string}`, spender as `0x${string}`],
          })
        )
      );

      // Filter to spenders that need approval
      const needsApproval = ALL_SPENDERS.filter((_, i) => {
        const allowanceHuman = Number(formatUnits(allowances[i], 6));
        return allowanceHuman < APPROVAL_THRESHOLD;
      });

      if (needsApproval.length === 0) {
        // All already approved
        await queryClient.invalidateQueries({ queryKey: ['usdc-balance', address] });
        return null;
      }

      let lastHash: string | null = null;

      for (const spender of needsApproval) {
        const hash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender as `0x${string}`, maxUint256],
        });

        lastHash = hash;
        setTxHash(hash);

        // Wait for TX receipt before sending next TX
        await client.waitForTransactionReceipt({ hash });
      }

      // Invalidate balance query so allowance refreshes
      await queryClient.invalidateQueries({ queryKey: ['usdc-balance', address] });

      return lastHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      setError(msg);
      return null;
    } finally {
      setIsApproving(false);
    }
  }, [address, wallets, queryClient]);

  return { approve, isApproving, error, txHash };
}
