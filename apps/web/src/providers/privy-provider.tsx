'use client';

import { PrivyProvider as Privy } from '@privy-io/react-auth';
import { createContext, useContext, type ReactNode } from 'react';

const PrivyAvailableContext = createContext(false);
export const usePrivyAvailable = () => useContext(PrivyAvailableContext);

interface PrivyProviderProps {
  children: ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const isSecureContext =
    typeof window !== 'undefined' &&
    (window.isSecureContext ||
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  // If no Privy app ID or insecure origin, render children without auth.
  // Privy's wallet SDK requires SubtleCrypto which is only available over HTTPS.
  if (!appId || !isSecureContext) {
    return (
      <PrivyAvailableContext.Provider value={false}>
        {children}
      </PrivyAvailableContext.Provider>
    );
  }

  return (
    <PrivyAvailableContext.Provider value={true}>
      <Privy
        appId={appId}
        config={{
          loginMethods: ['email', 'wallet', 'google', 'twitter'],
          appearance: {
            theme: 'dark',
            accentColor: '#676FFF',
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
          },
          defaultChain: {
            id: 137,
            name: 'Polygon',
            network: 'matic',
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18,
            },
            rpcUrls: {
              default: { http: ['https://polygon.drpc.org'] },
              public: { http: ['https://polygon.drpc.org'] },
            },
            blockExplorers: {
              default: { name: 'PolygonScan', url: 'https://polygonscan.com' },
            },
          },
          supportedChains: [
            {
              id: 137,
              name: 'Polygon',
              network: 'matic',
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18,
              },
              rpcUrls: {
                default: { http: ['https://polygon-rpc.com'] },
                public: { http: ['https://polygon-rpc.com'] },
              },
              blockExplorers: {
                default: { name: 'PolygonScan', url: 'https://polygonscan.com' },
              },
            },
          ],
        }}
      >
        {children}
      </Privy>
    </PrivyAvailableContext.Provider>
  );
}
