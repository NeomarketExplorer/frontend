'use client';

/**
 * Hook for CLOB L2 credential derivation
 * Automatically derives credentials when wallet connects.
 * Clears credentials on disconnect or address change.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import {
  buildClobAuthTypedData,
  buildL1Headers,
  type L2Credentials,
} from '@app/trading';
import { useClobCredentialStore, useWalletStore } from '@/stores';

// Route through our proxy to avoid CORS issues with custom POLY_* headers
const DIRECT_CLOB_API_URL = 'https://clob.polymarket.com';
const PROXY_CLOB_API_URL = '/api/clob';

async function fetchClob(path: string, init: RequestInit) {
  try {
    return await fetch(`${DIRECT_CLOB_API_URL}${path}`, init);
  } catch {
    return await fetch(`${PROXY_CLOB_API_URL}${path}`, init);
  }
}

/**
 * Derives or creates CLOB L2 credentials on wallet connect.
 * Must be called inside a Privy-gated component.
 */
export function useClobAuth() {
  const { wallets } = useWallets();
  const { address, isConnected } = useWalletStore();
  const {
    credentials,
    isDerivingCredentials,
    derivationError,
    setCredentials,
    setDeriving,
    setDerivationError,
    clearCredentials,
  } = useClobCredentialStore();

  // Guard against double-derivation
  const derivingRef = useRef(false);
  const lastAddressRef = useRef<string | null>(null);

  const deriveCredentials = useCallback(async () => {
    if (!address || derivingRef.current) return;
    derivingRef.current = true;
    setDeriving(true);

    try {
      const wallet = wallets.find(
        (w) => w.address.toLowerCase() === address.toLowerCase()
      );
      if (!wallet) throw new Error('Wallet not found');

      // Sign ClobAuth EIP-712 message (L1 auth)
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const typedData = buildClobAuthTypedData(address, timestamp);

      const provider = await wallet.getEthereumProvider();
      const signature = (await provider.request({
        method: 'eth_signTypedData_v4',
        params: [
          address,
          JSON.stringify({
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
              ],
              ...typedData.types,
            },
            primaryType: typedData.primaryType,
            domain: typedData.domain,
            message: {
              ...typedData.message,
              nonce: typedData.message.nonce.toString(),
            },
          }),
        ],
      })) as string;

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
      setCredentials(creds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to derive credentials';
      setDerivationError(msg);
    } finally {
      derivingRef.current = false;
    }
  }, [address, wallets, setCredentials, setDeriving, setDerivationError]);

  // Derive on connect, clear on disconnect / address change
  useEffect(() => {
    if (!isConnected || !address) {
      if (lastAddressRef.current) {
        lastAddressRef.current = null;
        clearCredentials();
      }
      return;
    }

    // Address changed — clear old credentials and re-derive
    if (lastAddressRef.current && lastAddressRef.current !== address) {
      clearCredentials();
    }

    // Only derive if we don't have credentials for this address
    if (!credentials && !derivingRef.current) {
      deriveCredentials();
    }
  }, [isConnected, address, credentials, deriveCredentials, clearCredentials]);

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
