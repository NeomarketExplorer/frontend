'use client';

/**
 * Hook for approving conditional token (ERC-1155) transfers on Polymarket.
 * Required before SELL orders — the exchange needs operator approval on the
 * CTF contract to transfer tokens out of the user's wallet.
 *
 * For regular markets:  approve CTF Exchange as operator
 * For neg-risk markets: approve NegRisk CTF Exchange as operator
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallets } from '@privy-io/react-auth';
import { createPublicClient, http, erc1155Abi } from 'viem';
import { useWalletStore } from '@/stores';
import { CHAIN_CONFIG } from '@app/config';

const CTF_ADDRESS = CHAIN_CONFIG.polygon.ctf;
const POLYGON_RPC_URL = CHAIN_CONFIG.polygon.rpcUrl;

// setApprovalForAll(address operator, bool approved) = 0xa22cb465
const SET_APPROVAL_FOR_ALL_SELECTOR = '0xa22cb465';

let publicClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({ transport: http(POLYGON_RPC_URL) });
  }
  return publicClient;
}

function buildSetApprovalForAllData(operator: string): string {
  return (
    SET_APPROVAL_FOR_ALL_SELECTOR +
    operator.slice(2).toLowerCase().padStart(64, '0') +
    '0000000000000000000000000000000000000000000000000000000000000001' // true
  );
}

function getOperator(negRisk: boolean): string {
  return negRisk
    ? CHAIN_CONFIG.polygon.negRiskCtfExchange
    : CHAIN_CONFIG.polygon.ctfExchange;
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
 * Always safe to call — the on-chain check is lightweight and cached.
 */
export function useConditionalTokenApproval(negRisk = false): UseConditionalTokenApprovalResult {
  const { wallets } = useWallets();
  const { address } = useWalletStore();
  const queryClient = useQueryClient();
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const operator = getOperator(negRisk);

  // Check isApprovedForAll on-chain
  const approvalQuery = useQuery({
    queryKey: ['ctf-approval', address, operator],
    queryFn: async () => {
      if (!address) return false;
      const client = getPublicClient();
      const result = await client.readContract({
        address: CTF_ADDRESS,
        abi: erc1155Abi,
        functionName: 'isApprovedForAll',
        args: [address as `0x${string}`, operator as `0x${string}`],
      });
      return Boolean(result);
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

      // Ensure wallet is on Polygon
      const chainId = (await provider.request({ method: 'eth_chainId' })) as string;
      if (chainId !== '0x89') {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }],
        });
      }

      const hash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: CTF_ADDRESS,
            data: buildSetApprovalForAllData(operator),
          },
        ],
      })) as string;

      setTxHash(hash);

      // Refresh the approval check
      await queryClient.invalidateQueries({ queryKey: ['ctf-approval', address] });

      return hash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      setError(msg);
      return null;
    } finally {
      setIsApproving(false);
    }
  }, [address, wallets, queryClient, operator]);

  return {
    isApproved: approvalQuery.data ?? false,
    isChecking: approvalQuery.isLoading,
    approve,
    isApproving,
    error,
    txHash,
  };
}
