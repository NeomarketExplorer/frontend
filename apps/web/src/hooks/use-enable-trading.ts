'use client';

import { useState, useCallback } from 'react';
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

  const enableTrading = useCallback(async () => {
    setIsEnabling(true);
    setError(null);
    try {
      await approveUsdc();
      if (!ctfApproved) {
        await approveCTF();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable trading');
    } finally {
      setIsEnabling(false);
    }
  }, [approveUsdc, approveCTF, ctfApproved]);

  const isProcessing = isEnabling || isApprovingUsdc || isApprovingCTF;

  return { enableTrading, isEnabling: isProcessing, error };
}
