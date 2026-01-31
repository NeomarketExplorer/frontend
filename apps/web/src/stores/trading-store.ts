/**
 * Trading state store using Zustand
 * Handles trading-specific state like current market, order form, etc.
 */

import { create } from 'zustand';

type OrderMode = 'limit' | 'market';

interface OrderFormState {
  side: 'BUY' | 'SELL';
  outcomeIndex: number;
  price: string;
  size: string;
  mode: OrderMode;
}

interface TradingState {
  // Current selected market
  selectedMarketId: string | null;
  setSelectedMarketId: (id: string | null) => void;

  // Order form state
  orderForm: OrderFormState;
  setOrderSide: (side: 'BUY' | 'SELL') => void;
  setOrderOutcome: (index: number) => void;
  setOrderPrice: (price: string) => void;
  setOrderSize: (size: string) => void;
  setOrderMode: (mode: OrderMode) => void;
  resetOrderForm: () => void;

  // Orderbook settings
  orderbookPrecision: number;
  setOrderbookPrecision: (precision: number) => void;

  // Chart settings
  chartInterval: '1h' | '6h' | '1d' | '1w' | 'max';
  setChartInterval: (interval: '1h' | '6h' | '1d' | '1w' | 'max') => void;

  // Active tab in market view
  activeMarketTab: 'orderbook' | 'trades' | 'positions';
  setActiveMarketTab: (tab: 'orderbook' | 'trades' | 'positions') => void;
}

const defaultOrderForm: OrderFormState = {
  side: 'BUY',
  outcomeIndex: 0,
  price: '',
  size: '',
  mode: 'market',
};

export const useTradingStore = create<TradingState>((set) => ({
  // Current selected market
  selectedMarketId: null,
  setSelectedMarketId: (id) => set({ selectedMarketId: id }),

  // Order form state
  orderForm: { ...defaultOrderForm },
  setOrderSide: (side) =>
    set((state) => ({ orderForm: { ...state.orderForm, side } })),
  setOrderOutcome: (index) =>
    set((state) => ({ orderForm: { ...state.orderForm, outcomeIndex: index } })),
  setOrderPrice: (price) =>
    set((state) => ({ orderForm: { ...state.orderForm, price } })),
  setOrderSize: (size) =>
    set((state) => ({ orderForm: { ...state.orderForm, size } })),
  setOrderMode: (mode) =>
    set((state) => ({ orderForm: { ...state.orderForm, mode } })),
  resetOrderForm: () => set({ orderForm: { ...defaultOrderForm } }),

  // Orderbook settings
  orderbookPrecision: 0.01,
  setOrderbookPrecision: (precision) => set({ orderbookPrecision: precision }),

  // Chart settings
  chartInterval: '1w',
  setChartInterval: (interval) => set({ chartInterval: interval }),

  // Active tab in market view
  activeMarketTab: 'orderbook',
  setActiveMarketTab: (tab) => set({ activeMarketTab: tab }),
}));
