'use client';

/**
 * Hook for approving USDC spend on Polymarket CTF Exchange.
 * Sends approve(spender, maxUint256) TX via Privy wallet.
 */

import { useState, useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useWalletStore } from '@/stores';
import { useQueryClient } from '@tanstack/react-query';

const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

// ERC20 approve(address,uint256) function selector + encoding
// approve(address spender, uint256 amount) where amount = maxUint256
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
// Function selector for approve(address,uint256) = 0x095ea7b3
const APPROVE_DATA =
  '0x095ea7b3' +
  CTF_EXCHANGE.slice(2).padStart(64, '0') +
  MAX_UINT256.slice(2);

interface UseTokenApprovalResult {
  approve: () => Promise<string | null>;
  isApproving: boolean;
  error: string | null;
  txHash: string | null;
}

/**
 * Returns a function to approve USDC for CTF Exchange.
 * Uses max uint256 approval for convenience.
 */
export function useTokenApproval(): UseTokenApprovalResult {
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

      const hash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: USDC_ADDRESS,
            data: APPROVE_DATA,
          },
        ],
      })) as string;

      setTxHash(hash);

      // Invalidate balance query so allowance refreshes
      await queryClient.invalidateQueries({ queryKey: ['usdc-balance', address] });

      return hash;
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
