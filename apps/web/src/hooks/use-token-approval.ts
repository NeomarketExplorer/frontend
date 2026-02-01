'use client';

/**
 * Hook for approving USDC spend on Polymarket exchange contracts.
 * Sends approve(spender, maxUint256) TX via wallet provider.
 * Supports both CTF Exchange and Neg Risk CTF Exchange.
 */

import { useState, useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useWalletStore } from '@/stores';
import { useQueryClient } from '@tanstack/react-query';
import { CHAIN_CONFIG } from '@app/config';

const USDC_ADDRESS = CHAIN_CONFIG.polygon.usdc;
const MAX_UINT256_HEX = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
// Function selector for approve(address,uint256) = 0x095ea7b3
const APPROVE_SELECTOR = '0x095ea7b3';

function buildApproveData(spender: string): string {
  return APPROVE_SELECTOR + spender.slice(2).toLowerCase().padStart(64, '0') + MAX_UINT256_HEX;
}

interface UseTokenApprovalResult {
  approve: () => Promise<string | null>;
  isApproving: boolean;
  error: string | null;
  txHash: string | null;
}

/**
 * Returns a function to approve USDC for a given spender contract.
 * Defaults to CTF Exchange; pass negRisk=true for Neg Risk CTF Exchange.
 */
export function useTokenApproval(negRisk = false): UseTokenApprovalResult {
  const { wallets } = useWallets();
  const { address } = useWalletStore();
  const queryClient = useQueryClient();
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const spender = negRisk
    ? CHAIN_CONFIG.polygon.negRiskCtfExchange
    : CHAIN_CONFIG.polygon.ctfExchange;

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

      // Ensure wallet is on Polygon (chain ID 137 = 0x89)
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
            to: USDC_ADDRESS,
            data: buildApproveData(spender),
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
  }, [address, wallets, queryClient, spender]);

  return { approve, isApproving, error, txHash };
}
