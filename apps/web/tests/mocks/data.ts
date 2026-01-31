/**
 * Mock data for testing - matches Polymarket API schemas
 */

// =============================================================================
// Gamma API Mock Data (Markets & Events)
// =============================================================================

export const mockTag = {
  id: 'tag-1',
  label: 'Politics',
  slug: 'politics',
};

export const mockMarket = {
  id: 'market-1',
  condition_id: '0x1234567890abcdef1234567890abcdef12345678',
  question: 'Will Bitcoin reach $100,000 by end of 2025?',
  description: 'This market resolves to "Yes" if Bitcoin reaches $100,000 USD on any major exchange before December 31, 2025.',
  outcomes: [
    { outcome: 'Yes', price: 0.65 },
    { outcome: 'No', price: 0.35 },
  ],
  slug: 'bitcoin-100k-2025',
  end_date_iso: '2025-12-31T23:59:59Z',
  closed: false,
  active: true,
  archived: false,
  volume: 1500000,
  volume_24hr: 75000,
  liquidity: 250000,
  image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/bitcoin.png',
  icon: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/bitcoin-icon.png',
  category: 'Crypto',
  tokens: [
    { token_id: 'token-yes-1', outcome: 'Yes', price: 0.65 },
    { token_id: 'token-no-1', outcome: 'No', price: 0.35 },
  ],
};

export const mockMarkets = [
  mockMarket,
  {
    id: 'market-2',
    condition_id: '0xabcdef1234567890abcdef1234567890abcdef12',
    question: 'Who will win the 2024 US Presidential Election?',
    description: 'This market resolves based on the official winner of the 2024 US Presidential Election.',
    outcomes: [
      { outcome: 'Democrat', price: 0.48 },
      { outcome: 'Republican', price: 0.52 },
    ],
    slug: 'us-presidential-election-2024',
    end_date_iso: '2024-11-05T23:59:59Z',
    closed: false,
    active: true,
    archived: false,
    volume: 5000000,
    volume_24hr: 250000,
    liquidity: 800000,
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/election.png',
    category: 'Politics',
    tokens: [
      { token_id: 'token-dem-2', outcome: 'Democrat', price: 0.48 },
      { token_id: 'token-rep-2', outcome: 'Republican', price: 0.52 },
    ],
  },
  {
    id: 'market-3',
    condition_id: '0x567890abcdef1234567890abcdef123456789012',
    question: 'Will Ethereum ETF be approved by SEC in Q1 2024?',
    description: 'Resolves Yes if SEC approves a spot Ethereum ETF before March 31, 2024.',
    outcomes: [
      { outcome: 'Yes', price: 0.25 },
      { outcome: 'No', price: 0.75 },
    ],
    slug: 'ethereum-etf-q1-2024',
    end_date_iso: '2024-03-31T23:59:59Z',
    closed: true,
    active: false,
    archived: false,
    volume: 2000000,
    volume_24hr: 0,
    liquidity: 0,
    category: 'Crypto',
    tokens: [
      { token_id: 'token-yes-3', outcome: 'Yes', price: 0.25 },
      { token_id: 'token-no-3', outcome: 'No', price: 0.75 },
    ],
  },
];

export const mockEvent = {
  id: 'event-1',
  title: '2024 US Presidential Election',
  description: 'Markets related to the 2024 United States Presidential Election',
  slug: '2024-us-presidential-election',
  image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/election-banner.png',
  icon: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/election-icon.png',
  markets: [mockMarkets[1]],
  category: 'Politics',
  tags: [mockTag],
  end_date: '2024-11-05T23:59:59Z',
  active: true,
  closed: false,
  archived: false,
  volume: 5000000,
  volume_24hr: 250000,
  liquidity: 800000,
};

export const mockEvents = [
  mockEvent,
  {
    id: 'event-2',
    title: 'Crypto Price Predictions',
    description: 'Markets predicting cryptocurrency prices',
    slug: 'crypto-price-predictions',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/crypto-banner.png',
    markets: [mockMarkets[0], mockMarkets[2]],
    category: 'Crypto',
    tags: [{ id: 'tag-2', label: 'Crypto', slug: 'crypto' }],
    active: true,
    closed: false,
    archived: false,
    volume: 3500000,
    volume_24hr: 75000,
    liquidity: 250000,
  },
  {
    id: 'event-3',
    title: 'Super Bowl LVIII',
    description: 'Markets for Super Bowl LVIII',
    slug: 'super-bowl-lviii',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/superbowl.png',
    markets: [],
    category: 'Sports',
    tags: [{ id: 'tag-3', label: 'Sports', slug: 'sports' }],
    active: true,
    closed: false,
    archived: false,
    volume: 1000000,
    volume_24hr: 50000,
    liquidity: 150000,
  },
];

// =============================================================================
// CLOB API Mock Data (Orderbook & Trades)
// =============================================================================

export const mockOrderbook = {
  market: '0x1234567890abcdef1234567890abcdef12345678',
  asset_id: 'token-yes-1',
  hash: '0xhash123',
  timestamp: '1699900000',
  bids: [
    { price: '0.64', size: '1000' },
    { price: '0.63', size: '2500' },
    { price: '0.62', size: '5000' },
    { price: '0.61', size: '7500' },
    { price: '0.60', size: '10000' },
  ],
  asks: [
    { price: '0.66', size: '1200' },
    { price: '0.67', size: '3000' },
    { price: '0.68', size: '4500' },
    { price: '0.69', size: '6000' },
    { price: '0.70', size: '8000' },
  ],
};

export const mockEmptyOrderbook = {
  market: '0xempty',
  asset_id: 'token-empty',
  bids: [],
  asks: [],
};

export const mockTrade = {
  id: 'trade-1',
  taker_order_id: 'order-123',
  market: '0x1234567890abcdef1234567890abcdef12345678',
  asset_id: 'token-yes-1',
  side: 'BUY',
  price: '0.65',
  size: '100',
  fee_rate_bps: '0',
  timestamp: '1699900000',
  transaction_hash: '0xtxhash123',
};

export const mockTrades = [
  mockTrade,
  {
    id: 'trade-2',
    taker_order_id: 'order-124',
    market: '0x1234567890abcdef1234567890abcdef12345678',
    asset_id: 'token-yes-1',
    side: 'SELL',
    price: '0.64',
    size: '50',
    fee_rate_bps: '0',
    timestamp: '1699899900',
    transaction_hash: '0xtxhash124',
  },
  {
    id: 'trade-3',
    taker_order_id: 'order-125',
    market: '0x1234567890abcdef1234567890abcdef12345678',
    asset_id: 'token-yes-1',
    side: 'BUY',
    price: '0.65',
    size: '200',
    fee_rate_bps: '0',
    timestamp: '1699899800',
    transaction_hash: '0xtxhash125',
  },
];

export const mockPriceHistory = [
  { t: 1699800000, p: 0.60 },
  { t: 1699810000, p: 0.62 },
  { t: 1699820000, p: 0.61 },
  { t: 1699830000, p: 0.63 },
  { t: 1699840000, p: 0.64 },
  { t: 1699850000, p: 0.65 },
  { t: 1699860000, p: 0.64 },
  { t: 1699870000, p: 0.66 },
  { t: 1699880000, p: 0.65 },
  { t: 1699890000, p: 0.65 },
];

// =============================================================================
// Data API Mock Data (Positions & Activity)
// =============================================================================

export const mockPosition = {
  asset: 'token-yes-1',
  condition_id: '0x1234567890abcdef1234567890abcdef12345678',
  outcome_index: 0,
  size: 100,
  avg_price: 0.55,
  cur_price: 0.65,
  initial_value: 55,
  current_value: 65,
  pnl: 10,
  pnl_percent: 18.18,
  realized_pnl: 0,
  unrealized_pnl: 10,
};

export const mockPositions = [
  mockPosition,
  {
    asset: 'token-dem-2',
    condition_id: '0xabcdef1234567890abcdef1234567890abcdef12',
    outcome_index: 0,
    size: 200,
    avg_price: 0.45,
    cur_price: 0.48,
    initial_value: 90,
    current_value: 96,
    pnl: 6,
    pnl_percent: 6.67,
    realized_pnl: 0,
    unrealized_pnl: 6,
  },
  {
    asset: 'token-no-3',
    condition_id: '0x567890abcdef1234567890abcdef123456789012',
    outcome_index: 1,
    size: 50,
    avg_price: 0.70,
    cur_price: 0.75,
    initial_value: 35,
    current_value: 37.5,
    pnl: 2.5,
    pnl_percent: 7.14,
    realized_pnl: 0,
    unrealized_pnl: 2.5,
  },
];

export const mockActivity = {
  id: 'activity-1',
  type: 'trade' as const,
  timestamp: '2024-01-15T10:30:00Z',
  asset: 'token-yes-1',
  condition_id: '0x1234567890abcdef1234567890abcdef12345678',
  side: 'BUY' as const,
  price: 0.55,
  size: 100,
  value: 55,
  fee: 0.055,
  transaction_hash: '0xtxhash100',
};

export const mockActivities = [
  mockActivity,
  {
    id: 'activity-2',
    type: 'trade' as const,
    timestamp: '2024-01-14T15:45:00Z',
    asset: 'token-dem-2',
    condition_id: '0xabcdef1234567890abcdef1234567890abcdef12',
    side: 'BUY' as const,
    price: 0.45,
    size: 200,
    value: 90,
    fee: 0.09,
    transaction_hash: '0xtxhash101',
  },
  {
    id: 'activity-3',
    type: 'trade' as const,
    timestamp: '2024-01-13T09:20:00Z',
    asset: 'token-no-3',
    condition_id: '0x567890abcdef1234567890abcdef123456789012',
    side: 'BUY' as const,
    price: 0.70,
    size: 50,
    value: 35,
    fee: 0.035,
    transaction_hash: '0xtxhash102',
  },
  {
    id: 'activity-4',
    type: 'transfer' as const,
    timestamp: '2024-01-12T14:00:00Z',
    value: 500,
    transaction_hash: '0xtxhash103',
  },
];

// =============================================================================
// User / Wallet Mock Data
// =============================================================================

export const mockUserAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f8fD9e';
export const mockUserAddress2 = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';

export const mockUserBalance = {
  usdc: 1000.50,
  conditional_tokens: {
    'token-yes-1': 100,
    'token-dem-2': 200,
    'token-no-3': 50,
  },
};
