'use client';

/**
 * Hook for approving conditional token (ERC-1155) transfers on Polymarket.
 * Required before SELL orders — the exchange needs operator approval on the
 * CTF contract to transfer tokens out of the user's wallet.
 *
 * For regular markets:  approve CTF Exchange as operator
 * For neg-risk markets: approve NegRisk CTF Exchange + NegRisk Adapter (2 TXs)
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallets } from '@privy-io/react-auth';
import { createPublicClient, createWalletClient, custom, http, erc1155Abi } from 'viem';
import { polygon } from 'viem/chains';
import { useWalletStore } from '@/stores';
import { CHAIN_CONFIG } from '@app/config';

const CTF_ADDRESS = CHAIN_CONFIG.polygon.ctf;
const POLYGON_RPC_URL = CHAIN_CONFIG.polygon.rpcUrl;

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

/**
 * Returns all operators that need ERC-1155 approval for the given market type.
 * - neg-risk: NegRisk CTF Exchange + NegRisk Adapter
 * - regular: CTF Exchange
 */
function getOperators(negRisk: boolean): string[] {
  return negRisk
    ? [CHAIN_CONFIG.polygon.negRiskCtfExchange, CHAIN_CONFIG.polygon.negRiskAdapter]
    : [CHAIN_CONFIG.polygon.ctfExchange];
}

interface UseConditionalTokenApprovalResult {
  isApproved: boolean;
  isChecking: boolean;
  approve: () => Promise<string | null>;
  isApproving: boolean;
  error: string | null;
  txHash: string | null;
}

/**
 * Checks and manages ERC-1155 operator approval for the CTF contract.
 * Checks ALL required operators — only returns isApproved=true when all pass.
 * approve() sends one TX per unapproved operator and waits for each receipt.
 */
export function useConditionalTokenApproval(negRisk = false): UseConditionalTokenApprovalResult {
  const { wallets } = useWallets();
  const { address } = useWalletStore();
  const queryClient = useQueryClient();
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const operators = getOperators(negRisk);

  // Check isApprovedForAll on-chain for ALL operators
  const approvalQuery = useQuery({
    queryKey: ['ctf-approval', address, ...operators],
    queryFn: async () => {
      if (!address) return false;
      const client = getPublicClient();
      const results = await Promise.all(
        operators.map((op) =>
          client.readContract({
            address: CTF_ADDRESS,
            abi: erc1155Abi,
            functionName: 'isApprovedForAll',
            args: [address as `0x${string}`, op as `0x${string}`],
          })
        )
      );
      // Only approved when ALL operators are approved
      return results.every(Boolean);
    },
    enabled: !!address,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

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

      // Check which operators still need approval
      const approvalStatuses = await Promise.all(
        operators.map((op) =>
          client.readContract({
            address: CTF_ADDRESS,
            abi: erc1155Abi,
            functionName: 'isApprovedForAll',
            args: [address as `0x${string}`, op as `0x${string}`],
          })
        )
      );

      const unapprovedOperators = operators.filter((_, i) => !approvalStatuses[i]);

      if (unapprovedOperators.length === 0) {
        // Already all approved — just refresh the query
        await queryClient.invalidateQueries({ queryKey: ['ctf-approval', address] });
        return null;
      }

      let lastHash: string | null = null;

      for (const operator of unapprovedOperators) {
        const hash = await walletClient.writeContract({
          address: CTF_ADDRESS,
          abi: erc1155Abi,
          functionName: 'setApprovalForAll',
          args: [operator as `0x${string}`, true],
        });

        lastHash = hash;
        setTxHash(hash);

        // Wait for TX receipt before sending next TX
        await client.waitForTransactionReceipt({ hash });
      }

      // Refresh the approval check after all TXs are confirmed
      await queryClient.invalidateQueries({ queryKey: ['ctf-approval', address] });

      return lastHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      setError(msg);
      return null;
    } finally {
      setIsApproving(false);
    }
  }, [address, wallets, queryClient, operators]);

  return {
    isApproved: approvalQuery.data ?? false,
    isChecking: approvalQuery.isLoading,
    approve,
    isApproving,
    error,
    txHash,
  };
}
