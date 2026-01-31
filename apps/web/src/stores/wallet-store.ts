/**
 * Wallet state store using Zustand
 * Handles wallet connection and user balance state
 */

import { create } from 'zustand';

interface WalletState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  softDisconnected: boolean;

  // Balance
  usdcBalance: number;
  isLoadingBalance: boolean;

  // Actions
  setConnected: (connected: boolean, address?: string | null) => void;
  setConnecting: (connecting: boolean) => void;
  setBalance: (balance: number) => void;
  setLoadingBalance: (loading: boolean) => void;
  softDisconnect: () => void;
  resume: () => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  // Connection state
  isConnected: false,
  isConnecting: false,
  address: null,
  softDisconnected: false,

  // Balance
  usdcBalance: 0,
  isLoadingBalance: false,

  // Actions
  setConnected: (connected, address = null) =>
    set({ isConnected: connected, address, isConnecting: false, softDisconnected: false }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setBalance: (balance) => set({ usdcBalance: balance }),
  setLoadingBalance: (loading) => set({ isLoadingBalance: loading }),
  softDisconnect: () =>
    set({
      isConnected: false,
      isConnecting: false,
      address: null,
      softDisconnected: true,
    }),
  resume: () => set({ softDisconnected: false }),
  disconnect: () =>
    set({
      isConnected: false,
      isConnecting: false,
      address: null,
      usdcBalance: 0,
      softDisconnected: false,
    }),
}));
