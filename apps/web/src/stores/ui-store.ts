/**
 * UI state store using Zustand
 * Handles global UI state like theme, sidebar, modals, etc.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Mobile menu
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // Search
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Market view preferences
  marketViewMode: 'grid' | 'list';
  setMarketViewMode: (mode: 'grid' | 'list') => void;

  // Trading panel
  tradingPanelExpanded: boolean;
  setTradingPanelExpanded: (expanded: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Sidebar
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Mobile menu
      mobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

      // Search
      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),

      // Market view preferences
      marketViewMode: 'grid',
      setMarketViewMode: (mode) => set({ marketViewMode: mode }),

      // Trading panel
      tradingPanelExpanded: true,
      setTradingPanelExpanded: (expanded) => set({ tradingPanelExpanded: expanded }),
    }),
    {
      name: 'polymarket-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        marketViewMode: state.marketViewMode,
        tradingPanelExpanded: state.tradingPanelExpanded,
      }),
    }
  )
);
