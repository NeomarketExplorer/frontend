/**
 * Authentication hooks using Privy
 *
 * These hooks must only be called inside components rendered within PrivyProvider.
 * Use `usePrivyAvailable()` to gate rendering before calling these.
 */

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useRef } from 'react';
import { useWalletStore } from '@/stores';
import { useClobCredentialStore } from '@/stores';

/**
 * Hook to sync Privy auth state with our wallet store.
 * Detects external wallet address changes and forces re-connect.
 * Must only be called when Privy is available (inside PrivyProvider).
 */
export function useAuth() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const setConnected = useWalletStore((state) => state.setConnected);
  const setConnecting = useWalletStore((state) => state.setConnecting);
  const disconnect = useWalletStore((state) => state.disconnect);
  const isConnecting = useWalletStore((state) => state.isConnecting);
  const storedAddress = useWalletStore((state) => state.address);

  // Track the address we've synced to detect external changes
  const syncedAddressRef = useRef<string | null>(null);

  const loginWithState = useCallback(() => {
    login();
  }, [login]);

  const logoutWithState = useCallback(async () => {
    await logout();
  }, [logout]);

  // Sync auth state
  useEffect(() => {
    if (!ready) {
      if (!isConnecting) {
        setConnecting(true);
      }
      return;
    }

    if (authenticated && user) {
      const wallet = wallets[0];
      const address = wallet?.address ?? user.wallet?.address ?? null;
      setConnected(Boolean(address), address);
      syncedAddressRef.current = address;
    } else {
      disconnect();
      syncedAddressRef.current = null;
    }
  }, [ready, authenticated, user, wallets, isConnecting, setConnected, setConnecting, disconnect]);

  // Detect external wallet address changes (user switched account in MetaMask)
  useEffect(() => {
    if (!ready || !authenticated || !storedAddress) return;

    const wallet = wallets[0];
    const currentAddress = wallet?.address ?? null;

    // If the wallet address changed from what we synced, force re-connect
    if (
      currentAddress &&
      syncedAddressRef.current &&
      currentAddress.toLowerCase() !== syncedAddressRef.current.toLowerCase()
    ) {
      // Clear old credentials and disconnect — user must click Connect again
      useClobCredentialStore.getState().clearCredentials();
      logout();
    }
  }, [ready, authenticated, storedAddress, wallets, logout]);

  return {
    isReady: ready,
    isAuthenticated: authenticated,
    user,
    login: loginWithState,
    logout: logoutWithState,
    wallets,
  };
}

/**
 * Hook to get the active wallet.
 * Must only be called when Privy is available (inside PrivyProvider).
 */
export function useActiveWallet() {
  const { wallets, ready } = useWallets();
  const activeWallet = wallets[0] ?? null;

  return {
    wallet: activeWallet,
    address: activeWallet?.address ?? null,
    isReady: ready,
  };
}
