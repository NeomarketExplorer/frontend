/**
 * MSW handlers for Polymarket API mocking
 * Uses MSW v2 syntax (http.get, HttpResponse)
 */

import { http, HttpResponse } from 'msw';
import {
  mockMarkets,
  mockEvents,
  mockOrderbook,
  mockEmptyOrderbook,
  mockTrades,
  mockPriceHistory,
  mockPositions,
  mockActivities,
  mockUserAddress,
} from './data';

// API base URLs
const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';
const DATA_API = 'https://data-api.polymarket.com';

// =============================================================================
// Gamma API Handlers (Market Discovery)
// =============================================================================

const gammaHandlers = [
  // GET /markets - List markets with optional filters
  http.get(`${GAMMA_API}/markets`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const slug = url.searchParams.get('slug');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const active = url.searchParams.get('active');
    const closed = url.searchParams.get('closed');
    const tag = url.searchParams.get('tag');

    let filteredMarkets = [...mockMarkets];

    if (id) {
      filteredMarkets = filteredMarkets.filter((m) => m.id === id);
    }

    if (slug) {
      filteredMarkets = filteredMarkets.filter((m) => m.slug === slug);
    }

    if (active !== null) {
      const isActive = active === 'true';
      filteredMarkets = filteredMarkets.filter((m) => m.active === isActive);
    }

    if (closed !== null) {
      const isClosed = closed === 'true';
      filteredMarkets = filteredMarkets.filter((m) => m.closed === isClosed);
    }

    if (tag) {
      filteredMarkets = filteredMarkets.filter(
        (m) => m.category?.toLowerCase() === tag.toLowerCase()
      );
    }

    const paginatedMarkets = filteredMarkets.slice(offset, offset + limit);

    const rawMarkets = paginatedMarkets.map((m) => ({
      id: m.id,
      conditionId: m.condition_id,
      question: m.question,
      description: m.description,
      outcomes: JSON.stringify(m.outcomes.map((o) => o.outcome)),
      outcomePrices: JSON.stringify(m.outcomes.map((o) => String(o.price || 0))),
      slug: m.slug,
      endDateIso: m.end_date_iso,
      closed: m.closed,
      active: m.active,
      archived: m.archived,
      volumeNum: m.volume,
      volume24hr: m.volume_24hr,
      liquidityNum: m.liquidity,
      image: m.image,
      icon: 'icon' in m ? m.icon : undefined,
      category: m.category,
      clobTokenIds: m.tokens
        ? JSON.stringify(m.tokens.map((t) => t.token_id))
        : null,
    }));

    return HttpResponse.json(rawMarkets);
  }),

  // GET /events - List events with optional filters
  http.get(`${GAMMA_API}/events`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const slug = url.searchParams.get('slug');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const active = url.searchParams.get('active');
    const closed = url.searchParams.get('closed');

    let filteredEvents = [...mockEvents];

    if (id) {
      filteredEvents = filteredEvents.filter((e) => e.id === id);
    }

    if (slug) {
      filteredEvents = filteredEvents.filter((e) => e.slug === slug);
    }

    if (active !== null) {
      const isActive = active === 'true';
      filteredEvents = filteredEvents.filter((e) => e.active === isActive);
    }

    if (closed !== null) {
      const isClosed = closed === 'true';
      filteredEvents = filteredEvents.filter((e) => e.closed === isClosed);
    }

    const paginatedEvents = filteredEvents.slice(offset, offset + limit);

    const rawEvents = paginatedEvents.map((event) => ({
      ...event,
      markets: event.markets?.map((m: typeof mockMarkets[0]) => ({
        id: m.id,
        conditionId: m.condition_id,
        question: m.question,
        description: m.description,
        outcomes: JSON.stringify(m.outcomes.map((o) => o.outcome)),
        outcomePrices: JSON.stringify(m.outcomes.map((o) => String(o.price || 0))),
        slug: m.slug,
        endDateIso: m.end_date_iso,
        closed: m.closed,
        active: m.active,
        archived: m.archived,
        volumeNum: m.volume,
        volume24hr: m.volume_24hr,
        liquidityNum: m.liquidity,
        image: m.image,
        icon: 'icon' in m ? m.icon : undefined,
        category: m.category,
        clobTokenIds: m.tokens
          ? JSON.stringify(m.tokens.map((t) => t.token_id))
          : null,
      })),
    }));

    return HttpResponse.json(rawEvents);
  }),
];

// =============================================================================
// CLOB API Handlers (Trading)
// =============================================================================

const clobHandlers = [
  // GET /book - Get orderbook for a token
  http.get(`${CLOB_API}/book`, ({ request }) => {
    const url = new URL(request.url);
    const tokenId = url.searchParams.get('token_id');

    if (!tokenId) {
      return HttpResponse.json(
        { error: 'token_id is required' },
        { status: 400 }
      );
    }

    if (!tokenId.startsWith('token-')) {
      return HttpResponse.json({
        ...mockEmptyOrderbook,
        asset_id: tokenId,
      });
    }

    return HttpResponse.json({
      ...mockOrderbook,
      asset_id: tokenId,
    });
  }),

  // GET /midpoint - Get midpoint price for a token
  http.get(`${CLOB_API}/midpoint`, ({ request }) => {
    const url = new URL(request.url);
    const tokenId = url.searchParams.get('token_id');

    if (!tokenId) {
      return HttpResponse.json(
        { error: 'token_id is required' },
        { status: 400 }
      );
    }

    const bid = parseFloat(mockOrderbook.bids[0]?.price || '0');
    const ask = parseFloat(mockOrderbook.asks[0]?.price || '0');
    const mid = ((bid + ask) / 2).toFixed(4);

    return HttpResponse.json({ mid });
  }),

  // GET /trades - Get recent trades for a token
  http.get(`${CLOB_API}/trades`, ({ request }) => {
    const url = new URL(request.url);
    const tokenId = url.searchParams.get('token_id');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    if (!tokenId) {
      return HttpResponse.json(
        { error: 'token_id is required' },
        { status: 400 }
      );
    }

    const trades = mockTrades
      .filter((t) => t.asset_id === tokenId || tokenId.startsWith('token-'))
      .slice(0, limit)
      .map((t) => ({ ...t, asset_id: tokenId }));

    return HttpResponse.json(trades);
  }),

  // GET /prices-history - Get price history for a market
  http.get(`${CLOB_API}/prices-history`, ({ request }) => {
    const url = new URL(request.url);
    const market = url.searchParams.get('market');

    if (!market) {
      return HttpResponse.json(
        { error: 'market is required' },
        { status: 400 }
      );
    }

    return HttpResponse.json({ history: mockPriceHistory });
  }),
];

// =============================================================================
// Data API Handlers (Positions & Activity)
// =============================================================================

const dataHandlers = [
  // GET /positions - Get user positions
  http.get(`${DATA_API}/positions`, ({ request }) => {
    const url = new URL(request.url);
    const user = url.searchParams.get('user');
    const sizeThreshold = parseFloat(url.searchParams.get('sizeThreshold') || '0');

    if (!user) {
      return HttpResponse.json(
        { error: 'user is required' },
        { status: 400 }
      );
    }

    if (user !== mockUserAddress) {
      return HttpResponse.json([]);
    }

    const filteredPositions = mockPositions.filter(
      (p) => p.size >= sizeThreshold
    );

    return HttpResponse.json(filteredPositions);
  }),

  // GET /activity - Get user activity
  http.get(`${DATA_API}/activity`, ({ request }) => {
    const url = new URL(request.url);
    const user = url.searchParams.get('user');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const type = url.searchParams.get('type');

    if (!user) {
      return HttpResponse.json(
        { error: 'user is required' },
        { status: 400 }
      );
    }

    if (user !== mockUserAddress) {
      return HttpResponse.json([]);
    }

    let filteredActivities = [...mockActivities];

    if (type) {
      filteredActivities = filteredActivities.filter((a) => a.type === type);
    }

    const paginatedActivities = filteredActivities.slice(offset, offset + limit);

    return HttpResponse.json(paginatedActivities);
  }),
];

// =============================================================================
// Export All Handlers
// =============================================================================

export const handlers = [
  ...gammaHandlers,
  ...clobHandlers,
  ...dataHandlers,
];

export { gammaHandlers, clobHandlers, dataHandlers };
