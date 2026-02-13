/**
 * CLOB credential store
 * Stores per-user L2 credentials for authenticated CLOB requests.
 * Persisted in localStorage keyed by wallet address so credentials survive
 * across browser sessions — no re-derivation popup on return visits.
 */

import { create } from 'zustand';
import type { L2Credentials } from '@app/trading';

const STORAGE_PREFIX = 'clob-creds:';

function storageKey(address: string | null): string | null {
  if (!address) return null;
  return `${STORAGE_PREFIX}${address.toLowerCase()}`;
}

function loadFromStorage(address: string | null): L2Credentials | null {
  if (typeof window === 'undefined') return null;
  const key = storageKey(address);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.apiKey && parsed.secret && parsed.passphrase) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveToStorage(address: string | null, credentials: L2Credentials | null) {
  if (typeof window === 'undefined') return;
  const key = storageKey(address);
  if (!key) return;
  try {
    if (credentials) {
      localStorage.setItem(key, JSON.stringify(credentials));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

interface ClobCredentialState {
  credentials: L2Credentials | null;
  credentialAddress: string | null;
  isDerivingCredentials: boolean;
  derivationError: string | null;

  setCredentials: (credentials: L2Credentials, address: string) => void;
  setDeriving: (deriving: boolean) => void;
  setDerivationError: (error: string | null) => void;
  clearCredentials: () => void;
  /** Load credentials for a specific wallet address from sessionStorage */
  loadForAddress: (address: string | null) => void;
}

export const useClobCredentialStore = create<ClobCredentialState>((set) => ({
  credentials: null,
  credentialAddress: null,
  isDerivingCredentials: false,
  derivationError: null,

  setCredentials: (credentials, address) => {
    saveToStorage(address, credentials);
    set({
      credentials,
      credentialAddress: address.toLowerCase(),
      isDerivingCredentials: false,
      derivationError: null,
    });
  },
  setDeriving: (deriving) =>
    set({ isDerivingCredentials: deriving, derivationError: null }),
  setDerivationError: (error) =>
    set({ derivationError: error, isDerivingCredentials: false }),
  clearCredentials: () => {
    const { credentialAddress } = useClobCredentialStore.getState();
    saveToStorage(credentialAddress, null);
    set({
      credentials: null,
      credentialAddress: null,
      isDerivingCredentials: false,
      derivationError: null,
    });
  },
  loadForAddress: (address) => {
    const loaded = loadFromStorage(address);
    set({
      credentials: loaded,
      credentialAddress: address?.toLowerCase() ?? null,
    });
  },
}));
