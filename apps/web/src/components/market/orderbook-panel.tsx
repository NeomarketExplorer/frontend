'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@app/ui';

type FlashType = 'positive' | 'negative' | 'accent';

interface OrderbookLevel {
  price: number;
  size: number;
}

interface OrderbookPanelProps {
  orderbook: { bids: OrderbookLevel[]; asks: OrderbookLevel[] } | null | undefined;
  midpoint: number | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

function useOrderbookFlash(orderbook: OrderbookPanelProps['orderbook']) {
  const prevRef = useRef<{ bids: OrderbookLevel[]; asks: OrderbookLevel[] } | null>(null);
  const flashCounterRef = useRef(0);

  const { flashMap, flashId } = useMemo(() => {
    const map = new Map<string, FlashType>();
    if (!orderbook) return { flashMap: map, flashId: flashCounterRef.current };
    const prev = prevRef.current;
    if (prev) {
      const prevBids = prev.bids;
      const curBids = orderbook.bids;
      for (let i = 0; i < curBids.length; i++) {
        const cur = curBids[i];
        const old = prevBids[i];
        if (!old) {
          map.set(`bid:${i}`, 'accent');
        } else if (cur.price !== old.price || cur.size !== old.size) {
          map.set(`bid:${i}`, cur.price > old.price ? 'positive' : cur.price < old.price ? 'negative' : 'positive');
        }
      }
      const prevAsks = prev.asks;
      const curAsks = orderbook.asks;
      for (let i = 0; i < curAsks.length; i++) {
        const cur = curAsks[i];
        const old = prevAsks[i];
        if (!old) {
          map.set(`ask:${i}`, 'accent');
        } else if (cur.price !== old.price || cur.size !== old.size) {
          map.set(`ask:${i}`, cur.price < old.price ? 'positive' : cur.price > old.price ? 'negative' : 'negative');
        }
      }
    }
    if (map.size > 0) flashCounterRef.current += 1;
    return { flashMap: map, flashId: flashCounterRef.current };
  }, [orderbook]);

  useEffect(() => {
    if (orderbook) {
      prevRef.current = {
        bids: orderbook.bids.map((l) => ({ ...l })),
        asks: orderbook.asks.map((l) => ({ ...l })),
      };
    }
  }, [orderbook]);

  return { flashMap, flashId };
}

function useMidpointFlash(midpoint: number | null | undefined) {
  const prevRef = useRef<number | null>(null);
  const counterRef = useRef(0);

  const { flash, flashMidId } = useMemo(() => {
    let f: FlashType | null = null;
    if (midpoint != null && prevRef.current != null && midpoint !== prevRef.current) {
      f = midpoint > prevRef.current ? 'positive' : 'negative';
      counterRef.current += 1;
    }
    return { flash: f, flashMidId: counterRef.current };
  }, [midpoint]);

  useEffect(() => {
    if (midpoint != null) prevRef.current = midpoint;
  }, [midpoint]);

  return { flash, flashMidId };
}

export function OrderbookPanel({ orderbook, midpoint, isLoading, isError }: OrderbookPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [levelCount, setLevelCount] = useState(12);
  const [showTotal, setShowTotal] = useState(true);
  const { flashMap, flashId } = useOrderbookFlash(orderbook);
  const { flash: midFlash, flashMidId } = useMidpointFlash(midpoint);

  // Dynamic level count + responsive total column
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        const w = entry.contentRect.width;
        const levels = Math.max(8, Math.floor((h - 80) / 20));
        setLevelCount(levels);
        setShowTotal(w >= 280);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute cumulative depth for width bars
  const { bids, asks, maxCumulative } = useMemo(() => {
    if (!orderbook) return { bids: [], asks: [], maxCumulative: 0 };
    const b = orderbook.bids.slice(0, levelCount);
    const a = orderbook.asks.slice(0, levelCount);
    let cumBid = 0;
    const bidsWithCum = b.map((l) => { cumBid += l.size; return { ...l, cumSize: cumBid }; });
    let cumAsk = 0;
    const asksWithCum = a.map((l) => { cumAsk += l.size; return { ...l, cumSize: cumAsk }; });
    const maxCum = Math.max(cumBid, cumAsk, 1);
    return { bids: bidsWithCum, asks: asksWithCum, maxCumulative: maxCum };
  }, [orderbook, levelCount]);

  if (isLoading) {
    return (
      <div ref={containerRef} className="h-full flex flex-col">
        <div className="p-3 border-b border-[var(--card-border)]">
          <span className="text-sm font-semibold">Orderbook</span>
        </div>
        <div className="flex-1 p-3">
          <OrderbookSkeleton />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div ref={containerRef} className="h-full flex flex-col">
        <div className="p-3 border-b border-[var(--card-border)]">
          <span className="text-sm font-semibold">Orderbook</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Failed to load orderbook
        </div>
      </div>
    );
  }

  if (!orderbook?.bids.length && !orderbook?.asks.length) {
    return (
      <div ref={containerRef} className="h-full flex flex-col">
        <div className="p-3 border-b border-[var(--card-border)]">
          <span className="text-sm font-semibold">Orderbook</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No orderbook data
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--card-border)] flex items-center justify-between">
        <span className="text-sm font-semibold">Orderbook</span>
      </div>

      {/* Header row */}
      <div className="px-3 py-1 flex text-[0.6rem] font-mono text-muted-foreground uppercase tracking-wider">
        <span className="flex-1">Price</span>
        <span className="flex-1 text-right">Size</span>
        {showTotal && <span className="flex-1 text-right">Total</span>}
      </div>

      {/* Asks (reversed — lowest ask at bottom near midpoint) */}
      <div className="flex-1 flex flex-col justify-end overflow-hidden px-1">
        {asks.slice().reverse().map((level, idx) => {
          const i = asks.length - 1 - idx;
          const flash = flashMap.get(`ask:${i}`);
          const depthWidth = (level.cumSize / maxCumulative) * 100;
          return (
            <div
              key={`ask-${i}-${flash ? flashId : 'stable'}`}
              className={`flex items-center px-2 py-[2px] text-xs font-mono relative ${flash ? `flash-${flash}` : ''}`}
            >
              <div
                className="absolute inset-y-0 right-0 bg-[var(--danger)]/8"
                style={{ width: `${depthWidth}%` }}
              />
              <span className="flex-1 text-negative relative z-10">{level.price.toFixed(2)}</span>
              <span className="flex-1 text-right text-muted-foreground relative z-10">{level.size.toFixed(0)}</span>
              {showTotal && <span className="flex-1 text-right text-muted-foreground/60 relative z-10">{level.cumSize.toFixed(0)}</span>}
            </div>
          );
        })}
      </div>

      {/* Midpoint */}
      {midpoint != null && (
        <div className="px-3 py-1.5 border-y border-border/50 flex items-center justify-center gap-2 text-xs font-mono bg-[var(--background-secondary)]">
          <span className="text-muted-foreground text-[0.6rem]">MID</span>
          <span
            key={`mid-${midFlash ? flashMidId : 'stable'}`}
            className={`font-semibold ${midFlash ? `flash-text-${midFlash}` : ''}`}
          >
            {(midpoint * 100).toFixed(1)}c
          </span>
        </div>
      )}

      {/* Bids */}
      <div className="flex-1 flex flex-col overflow-hidden px-1">
        {bids.map((level, i) => {
          const flash = flashMap.get(`bid:${i}`);
          const depthWidth = (level.cumSize / maxCumulative) * 100;
          return (
            <div
              key={`bid-${i}-${flash ? flashId : 'stable'}`}
              className={`flex items-center px-2 py-[2px] text-xs font-mono relative ${flash ? `flash-${flash}` : ''}`}
            >
              <div
                className="absolute inset-y-0 right-0 bg-[var(--success)]/8"
                style={{ width: `${depthWidth}%` }}
              />
              <span className="flex-1 text-positive relative z-10">{level.price.toFixed(2)}</span>
              <span className="flex-1 text-right text-muted-foreground relative z-10">{level.size.toFixed(0)}</span>
              {showTotal && <span className="flex-1 text-right text-muted-foreground/60 relative z-10">{level.cumSize.toFixed(0)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderbookSkeleton() {
  return (
    <div className="space-y-1.5">
      <span className="sr-only">Loading orderbook...</span>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
      <div className="py-1 border-y border-border/50 flex justify-center">
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}
