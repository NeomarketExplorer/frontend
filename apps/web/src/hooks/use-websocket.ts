/**
 * WebSocket hooks for real-time market data
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createWebSocketManager, type WebSocketMessage, type WebSocketManager } from '@app/api';
import { orderbookKeys } from './use-orderbook';

// Singleton WebSocket manager with ref counting
let wsManager: WebSocketManager | null = null;
let wsRefCount = 0;

function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = createWebSocketManager({
      onOpen: () => console.log('[WS] Connected'),
      onClose: () => console.log('[WS] Disconnected'),
      onError: (e) => console.error('[WS] Error:', e),
    });
  }
  return wsManager;
}

function acquireWs(): WebSocketManager {
  wsRefCount++;
  return getWebSocketManager();
}

function releaseWs(): void {
  wsRefCount--;
  if (wsRefCount <= 0 && wsManager) {
    wsManager.disconnect();
    wsManager = null;
    wsRefCount = 0;
  }
}

/**
 * Hook to subscribe to real-time orderbook updates
 */
export function useRealtimeOrderbook(tokenId: string | null) {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!tokenId) return;

    const ws = acquireWs();
    ws.connect().catch(console.error);

    unsubscribeRef.current = ws.subscribeToOrderbook([tokenId], (message) => {
      if (message.type === 'book' && message.data) {
        queryClient.invalidateQueries({
          queryKey: orderbookKeys.token(tokenId),
        });
      }
    });

    return () => {
      unsubscribeRef.current?.();
      releaseWs();
    };
  }, [tokenId, queryClient]);
}

/**
 * Hook to subscribe to real-time price updates
 */
export function useRealtimePrices(tokenIds: string[]) {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (tokenIds.length === 0) return;

    const ws = acquireWs();
    ws.connect().catch(console.error);

    unsubscribeRef.current = ws.subscribeToPrices(tokenIds, (message) => {
      if (message.type === 'last_trade_price' && message.asset_id) {
        queryClient.invalidateQueries({
          queryKey: orderbookKeys.midpoint(message.asset_id),
        });
      }
    });

    return () => {
      unsubscribeRef.current?.();
      releaseWs();
    };
  }, [tokenIds.join(','), queryClient]);
}

/**
 * Hook for custom WebSocket subscriptions
 */
export function useWebSocketSubscription(
  type: 'book' | 'last_trade_price' | 'price_change',
  assetIds: string[],
  onMessage: (message: WebSocketMessage) => void
) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (assetIds.length === 0) return;

    const ws = acquireWs();
    ws.connect().catch(console.error);

    unsubscribeRef.current = ws.subscribe(
      { type, assets_ids: assetIds },
      (message) => onMessageRef.current(message)
    );

    return () => {
      unsubscribeRef.current?.();
      releaseWs();
    };
  }, [type, assetIds.join(',')]);
}

/**
 * Hook to get WebSocket connection status
 */
export function useWebSocketConnection() {
  const connect = useCallback(() => {
    return getWebSocketManager().connect();
  }, []);

  const disconnect = useCallback(() => {
    if (wsManager) {
      wsManager.disconnect();
      wsManager = null;
      wsRefCount = 0;
    }
  }, []);

  return { connect, disconnect };
}
