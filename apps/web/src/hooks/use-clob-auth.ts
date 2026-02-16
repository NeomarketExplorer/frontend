'use client';

/**
 * Hook for CLOB L2 credential derivation
 * Automatically derives credentials when wallet connects.
 * Clears credentials on disconnect or address change.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSignTypedData, useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom } from 'viem';
import { polygon } from 'viem/chains';
import {
  buildClobAuthTypedData,
  buildL1Headers,
  type L2Credentials,
} from '@app/trading';
import { useClobCredentialStore, useWalletStore } from '@/stores';

// CLOB requests go direct from the browser so the user's IP is used (geo-restriction).
// Polymarket blocks datacenter IPs, so proxy won't work for auth/trading.
const DIRECT_CLOB_URL = 'https://clob.polymarket.com';
const PROXY_CLOB_URL = '/api/clob';

async function fetchClob(path: string, init: RequestInit) {
  try {
    return await fetch(`${DIRECT_CLOB_URL}${path}`, init);
  } catch {
    return await fetch(`${PROXY_CLOB_URL}${path}`, init);
  }
}

/**
 * Derives or creates CLOB L2 credentials on wallet connect.
 * Must be called inside a Privy-gated component.
 */
export function useClobAuth() {
  const { signTypedData } = useSignTypedData();
  const { wallets, ready: walletsReady } = useWallets();
  const { address, isConnected } = useWalletStore();
  const {
    credentials,
    isDerivingCredentials,
    derivationError,
    setCredentials,
    setDeriving,
    setDerivationError,
    clearCredentials,
    loadForAddress,
  } = useClobCredentialStore();

  // Guard against double-derivation
  const derivingRef = useRef(false);
  const lastAddressRef = useRef<string | null>(null);

  const deriveCredentials = useCallback(async () => {
    if (!address || derivingRef.current) return;
    derivingRef.current = true;
    setDeriving(true);

    try {
      // Sign ClobAuth EIP-712 message (L1 auth)
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const typedData = buildClobAuthTypedData(address, timestamp);

      const wallet = wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());
      if (!wallet) throw new Error('Wallet not found. Please reconnect.');

      let signature: string;
      if (wallet.walletClientType === 'privy') {
        // Embedded wallet — silent signing via Privy
        signature = await signTypedData({
          domain: typedData.domain,
          types: { ClobAuth: [...typedData.types.ClobAuth] },
          primaryType: typedData.primaryType,
          message: {
            ...typedData.message,
            nonce: typedData.message.nonce.toString(),
          },
        }, undefined, address);
      } else {
        // External wallet (MetaMask, WalletConnect) — sign via provider
        const provider = await wallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: address as `0x${string}`,
          chain: polygon,
          transport: custom(provider),
        });
        signature = await walletClient.signTypedData({
          domain: typedData.domain,
          types: { ClobAuth: [...typedData.types.ClobAuth] },
          primaryType: 'ClobAuth',
          message: {
            ...typedData.message,
            nonce: BigInt(typedData.message.nonce),
          },
        });
      }

      // Build L1 headers
      const l1Headers = buildL1Headers(address, signature, timestamp);

      // Try derive first (returning user), then create (new user)
      let creds: L2Credentials;
      try {
        creds = await fetchCredentials('GET', '/auth/derive-api-key', l1Headers);
      } catch {
        creds = await fetchCredentials('POST', '/auth/api-key', l1Headers);
      }

      lastAddressRef.current = address;
      setCredentials(creds, address);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to derive credentials';
      setDerivationError(msg);
    } finally {
      derivingRef.current = false;
    }
  }, [address, wallets, signTypedData, setCredentials, setDeriving, setDerivationError]);

  // Derive on connect, clear on disconnect / address change
  useEffect(() => {
    if (!isConnected || !address) {
      if (lastAddressRef.current) {
        lastAddressRef.current = null;
        clearCredentials();
      }
      return;
    }

    // Address changed — load credentials for new address from session
    if (lastAddressRef.current !== address) {
      if (lastAddressRef.current) {
        clearCredentials();
      }
      loadForAddress(address);
      lastAddressRef.current = address;
    }

    // Wait for Privy wallets to be ready before attempting derivation
    if (!walletsReady || wallets.length === 0) return;

    // Derive if no credentials loaded for this address
    const currentCreds = useClobCredentialStore.getState().credentials;
    if (!currentCreds && !derivingRef.current) {
      deriveCredentials();
    }
  }, [isConnected, address, walletsReady, wallets.length, deriveCredentials, clearCredentials, loadForAddress]);

  return {
    credentials,
    isDerivingCredentials,
    derivationError,
    deriveCredentials,
  };
}

async function fetchCredentials(
  method: 'GET' | 'POST',
  path: string,
  headers: Record<string, string>
): Promise<L2Credentials> {
  const res = await fetchClob(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    apiKey: data.apiKey,
    secret: data.secret,
    passphrase: data.passphrase,
  };
}
