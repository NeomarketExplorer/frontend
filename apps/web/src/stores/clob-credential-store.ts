/**
 * CLOB credential store (memory-only)
 * Stores per-user L2 credentials for authenticated CLOB requests.
 * NEVER persisted to localStorage — cleared on page refresh or disconnect.
 */

import { create } from 'zustand';
import type { L2Credentials } from '@app/trading';

interface ClobCredentialState {
  credentials: L2Credentials | null;
  isDerivingCredentials: boolean;
  derivationError: string | null;

  setCredentials: (credentials: L2Credentials) => void;
  setDeriving: (deriving: boolean) => void;
  setDerivationError: (error: string | null) => void;
  clearCredentials: () => void;
}

export const useClobCredentialStore = create<ClobCredentialState>((set) => ({
  credentials: null,
  isDerivingCredentials: false,
  derivationError: null,

  setCredentials: (credentials) =>
    set({ credentials, isDerivingCredentials: false, derivationError: null }),
  setDeriving: (deriving) =>
    set({ isDerivingCredentials: deriving, derivationError: null }),
  setDerivationError: (error) =>
    set({ derivationError: error, isDerivingCredentials: false }),
  clearCredentials: () =>
    set({ credentials: null, isDerivingCredentials: false, derivationError: null }),
}));
