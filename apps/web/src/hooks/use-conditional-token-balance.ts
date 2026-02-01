'use client';

/**
 * Hook for querying on-chain ERC-1155 conditional token balance.
 * Calls CTF.balanceOf(address, tokenId) via viem.
 * Returns human-readable share count (raw / 1e6).
 */

import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { useWalletStore } from '@/stores';
import { CHAIN_CONFIG } from '@app/config';

const CTF_ADDRESS = CHAIN_CONFIG.polygon.ctf;
const POLYGON_RPC_URL = CHAIN_CONFIG.polygon.rpcUrl;

// ERC-1155 balanceOf ABI fragment
const BALANCE_OF_ABI = [
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

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
 * Fetches the on-chain conditional token balance for the connected wallet.
 * @param tokenId - The ERC-1155 token ID (outcome token)
 * @returns balance in human-readable shares (divided by 1e6)
 */
export function useConditionalTokenBalance(tokenId: string | null) {
  const { address } = useWalletStore();

  const query = useQuery({
    queryKey: ['ctf-balance', address, tokenId],
    queryFn: async () => {
      if (!address || !tokenId) return 0;
      const client = getPublicClient();
      const balance = await client.readContract({
        address: CTF_ADDRESS,
        abi: BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`, BigInt(tokenId)],
      });
      return Number(balance) / 1e6;
    },
    enabled: !!address && !!tokenId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    balance: query.data ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
