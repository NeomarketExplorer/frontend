/**
 * CLOB credential store
 * Stores per-user L2 credentials for authenticated CLOB requests.
 * Persisted in sessionStorage (cleared on tab close, survives refresh).
 * NOT localStorage — credentials don't persist across sessions.
 */

import { create } from 'zustand';
import type { L2Credentials } from '@app/trading';

const SESSION_KEY = 'clob-credentials';

function loadFromSession(): L2Credentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.apiKey && parsed.secret && parsed.passphrase) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveToSession(credentials: L2Credentials | null) {
  if (typeof window === 'undefined') return;
  try {
    if (credentials) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(credentials));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // sessionStorage may be unavailable in some contexts
  }
}

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
  credentials: loadFromSession(),
  isDerivingCredentials: false,
  derivationError: null,

  setCredentials: (credentials) => {
    saveToSession(credentials);
    set({ credentials, isDerivingCredentials: false, derivationError: null });
  },
  setDeriving: (deriving) =>
    set({ isDerivingCredentials: deriving, derivationError: null }),
  setDerivationError: (error) =>
    set({ derivationError: error, isDerivingCredentials: false }),
  clearCredentials: () => {
    saveToSession(null);
    set({ credentials: null, isDerivingCredentials: false, derivationError: null });
  },
}));
