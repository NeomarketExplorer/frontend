/**
 * Authentication hooks using Privy
 *
 * These hooks must only be called inside components rendered within PrivyProvider.
 * Use `usePrivyAvailable()` to gate rendering before calling these.
 */

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect } from 'react';
import { useWalletStore } from '@/stores';

/**
 * Hook to sync Privy auth state with our wallet store.
 * Must only be called when Privy is available (inside PrivyProvider).
 */
export function useAuth() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const setConnected = useWalletStore((state) => state.setConnected);
  const setConnecting = useWalletStore((state) => state.setConnecting);
  const disconnect = useWalletStore((state) => state.disconnect);
  const isConnecting = useWalletStore((state) => state.isConnecting);
  const softDisconnected = useWalletStore((state) => state.softDisconnected);

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
      if (softDisconnected) {
        setConnecting(false);
        return;
      }
      const wallet = wallets[0];
      const address = wallet?.address ?? user.wallet?.address ?? null;
      setConnected(Boolean(address), address);
    } else {
      disconnect();
    }
  }, [ready, authenticated, user, wallets, isConnecting, softDisconnected, setConnected, setConnecting, disconnect]);

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
