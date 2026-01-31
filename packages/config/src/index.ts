/**
 * @app/config - Centralized configuration for the Polymarket trading app
 *
 * Contains:
 * - Environment variable schemas (Zod)
 * - API endpoints and URLs
 * - Chain configurations
 * - Feature flags
 */

// Environment configuration
export * from './env';

// Date/time utilities
export * from './date';

// API endpoints
export const API_ENDPOINTS = {
  gamma: {
    base: '/gamma-api.polymarket.com',
    markets: '/markets',
    events: '/events',
  },
  clob: {
    base: '/clob.polymarket.com',
    auth: '/auth',
    orders: '/orders',
    orderbook: '/book',
    trades: '/trades',
    midpoints: '/midpoints',
  },
  data: {
    base: '/data-api.polymarket.com',
    positions: '/positions',
    activity: '/activity',
  },
} as const;

// Chain configuration
export const CHAIN_CONFIG = {
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const,
    ctf: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const,
    ctfExchange: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const,
    negRiskCtfExchange: '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const,
    negRiskAdapter: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as const,
  },
} as const;

// EIP-712 domain for L1 authentication (ClobAuth signing)
// Note: No verifyingContract field — this is intentional per Polymarket spec
export const CLOB_AUTH_DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: 137,
} as const;

// EIP-712 domain for order signing (CTF Exchange)
// This is a DIFFERENT domain than CLOB_AUTH_DOMAIN
export const CTF_EXCHANGE_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: 137,
  verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as `0x${string}`,
} as const;

// EIP-712 domain for neg-risk (multi-outcome) markets
export const NEG_RISK_CTF_EXCHANGE_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: 137,
  verifyingContract: '0xC5d563A36AE78145C45a50134d48A1215220f80a' as `0x${string}`,
} as const;

// Re-export zod for convenience
export { z } from 'zod';
