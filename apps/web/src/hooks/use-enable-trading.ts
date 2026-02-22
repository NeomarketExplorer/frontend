'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '@/stores';
import { useTokenApproval } from './use-token-approval';
import { useConditionalTokenApproval } from './use-conditional-token-approval';

export function useEnableTrading(negRisk: boolean) {
  const { approve: approveUsdc, isApproving: isApprovingUsdc } = useTokenApproval();
  const {
    approve: approveCTF,
    isApproving: isApprovingCTF,
    isApproved: ctfApproved,
  } = useConditionalTokenApproval(negRisk);
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { address } = useWalletStore();

  const enableTrading = useCallback(async () => {
    setIsEnabling(true);
    setError(null);
    try {
      await approveUsdc();
      if (!ctfApproved) {
        await approveCTF();
      }
      // Force refetch balance + allowance after all approvals complete
      // Individual hooks already invalidate, but this ensures a final
      // refresh after the entire batch so the UI reflects the new state.
      // Uses refetchQueries (not invalidateQueries) to wait for fresh data.
      if (address) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['usdc-balance', address] }),
          queryClient.refetchQueries({ queryKey: ['ctf-approval', address] }),
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable trading');
      throw err;
    } finally {
      setIsEnabling(false);
    }
  }, [approveUsdc, approveCTF, ctfApproved, queryClient, address]);

  const isProcessing = isEnabling || isApprovingUsdc || isApprovingCTF;

  return { enableTrading, isEnabling: isProcessing, error };
}
