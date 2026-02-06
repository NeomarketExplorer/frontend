'use client';

import { WagmiProvider as WagmiRoot } from 'wagmi';
import { wagmiConfig } from '@/lib/wagmi-config';
import type { ReactNode } from 'react';

export function WagmiProvider({ children }: { children: ReactNode }) {
  return <WagmiRoot config={wagmiConfig}>{children}</WagmiRoot>;
}
