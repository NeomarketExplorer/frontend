/**
 * CLOB credential store
 * Stores per-user L2 credentials for authenticated CLOB requests.
 * Persisted in sessionStorage keyed by wallet address (cleared on tab close, survives refresh).
 * NOT localStorage — credentials don't persist across sessions.
 */

import { create } from 'zustand';
import type { L2Credentials } from '@app/trading';

const SESSION_PREFIX = 'clob-creds:';

function sessionKey(address: string | null): string | null {
  if (!address) return null;
  return `${SESSION_PREFIX}${address.toLowerCase()}`;
}

function loadFromSession(address: string | null): L2Credentials | null {
  if (typeof window === 'undefined') return null;
  const key = sessionKey(address);
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.apiKey && parsed.secret && parsed.passphrase) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveToSession(address: string | null, credentials: L2Credentials | null) {
  if (typeof window === 'undefined') return;
  const key = sessionKey(address);
  if (!key) return;
  try {
    if (credentials) {
      sessionStorage.setItem(key, JSON.stringify(credentials));
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // sessionStorage may be unavailable in some contexts
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
    saveToSession(address, credentials);
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
    saveToSession(credentialAddress, null);
    set({
      credentials: null,
      credentialAddress: null,
      isDerivingCredentials: false,
      derivationError: null,
    });
  },
  loadForAddress: (address) => {
    const loaded = loadFromSession(address);
    set({
      credentials: loaded,
      credentialAddress: address?.toLowerCase() ?? null,
    });
  },
}));
