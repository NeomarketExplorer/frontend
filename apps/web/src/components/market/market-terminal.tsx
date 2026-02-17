'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@app/ui';
import {
  useMarket,
  useOrderbook,
  useMidpoint,
  useRealtimeOrderbook,
  useClobMarket,
  useMarketStats,
  useMarketCandles,
} from '@/hooks';
import { useTradingStore } from '@/stores';
import { buildOutcomeEntries, isYesOutcome, isNoOutcome } from '@/lib/outcomes';
import dynamic from 'next/dynamic';

const CandleChart = dynamic(() => import('@/components/candle-chart').then(m => m.CandleChart), {
  ssr: false,
  loading: () => <div className="flex-1 bg-muted/20 animate-pulse" />,
});
import { CompactHeader } from '@/components/market/compact-header';
import { TradePanel } from '@/components/market/trade-panel';
import { OrderbookPanel } from '@/components/market/orderbook-panel';
import { BottomTabs } from '@/components/market/bottom-tabs';

type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

interface MarketTerminalProps {
  id: string;
}

export function MarketTerminal({ id }: MarketTerminalProps) {
  const [chartInterval, setChartInterval] = useState<TimeInterval>('1h');
  const { data: market, isLoading: marketLoading } = useMarket(id);
  const { orderForm } = useTradingStore();

  const outcomes = useMemo(
    () => buildOutcomeEntries(market?.outcomes ?? [], market?.outcomePrices ?? []),
    [market?.outcomes, market?.outcomePrices]
  );

  const outcomeTokenIds = market?.outcomeTokenIds ?? [];
  const tokenIdA = outcomeTokenIds[0] ?? null;
  const tokenIdB = outcomeTokenIds[1] ?? null;
  const { data: midpointA } = useMidpoint(tokenIdA);
  const { data: midpointB } = useMidpoint(tokenIdB);
  const { data: clobMarket, isLoading: clobMarketLoading } = useClobMarket(market?.conditionId ?? null);
  const { data: marketStats } = useMarketStats(market?.conditionId);

  const mappedTokenIds = useMemo(() => {
    if (outcomes.length === 0) return outcomeTokenIds;

    if (clobMarket?.tokens?.length) {
      return outcomes.map((entry, index) => {
        const match = clobMarket.tokens.find((token: { outcome?: string; token_id?: string }) =>
          token.outcome?.trim().toLowerCase() === entry.label.trim().toLowerCase()
        );
        return match?.token_id ?? outcomeTokenIds[index];
      });
    }

    if (outcomeTokenIds.length === 2 && outcomes.length === 2) {
      const yesEntry = outcomes.find((entry) => isYesOutcome(entry.label));
      const noEntry = outcomes.find((entry) => isNoOutcome(entry.label));
      if (yesEntry && noEntry && midpointA != null && midpointB != null && yesEntry.price != null) {
        const distA = Math.abs(midpointA - yesEntry.price);
        const distB = Math.abs(midpointB - yesEntry.price);
        const yesToken = distA <= distB ? outcomeTokenIds[0] : outcomeTokenIds[1];
        const noToken = yesToken === outcomeTokenIds[0] ? outcomeTokenIds[1] : outcomeTokenIds[0];
        return outcomes.map((entry, index) => {
          if (isYesOutcome(entry.label)) return yesToken;
          if (isNoOutcome(entry.label)) return noToken;
          return outcomeTokenIds[index];
        });
      }
    }

    return outcomeTokenIds;
  }, [outcomeTokenIds, outcomes, midpointA, midpointB, clobMarket]);

  const tokenId = mappedTokenIds[orderForm.outcomeIndex] ?? null;
  const { data: orderbook, isLoading: orderbookLoading, isError: orderbookError } = useOrderbook(tokenId);
  const chartTokenId = outcomeTokenIds[orderForm.outcomeIndex] ?? null;
  const { data: candleData, isLoading: candlesLoading } = useMarketCandles(
    market?.conditionId,
    chartTokenId,
    chartInterval,
  );

  useRealtimeOrderbook(tokenId);

  const selectedMidpoint = orderForm.outcomeIndex === 0 ? midpointA : midpointB;

  if (marketLoading) {
    return <TerminalSkeleton />;
  }

  if (!market) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Market not found</h1>
          <p className="text-muted-foreground">The market you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop terminal layout (lg+) */}
      <div className="hidden lg:flex flex-col h-[calc(100vh-56px)] overflow-hidden">
        <CompactHeader
          question={market.question}
          image={market.image}
          category={market.category}
          volume={market.volume}
          endDateIso={market.endDateIso}
          midpoint={selectedMidpoint ?? null}
          marketStats={marketStats}
          chartInterval={chartInterval}
          onIntervalChange={setChartInterval}
        />

        {/* 2-column layout spanning full height */}
        <div className="flex-1 flex min-h-0">
          {/* Left column: Chart + Bottom Tabs */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {/* Chart — fills remaining height */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <CandleChart
                candles={candleData?.candles ?? []}
                isLoading={candlesLoading}
                fillContainer
              />
            </div>
            {/* Bottom tabs */}
            <div className="h-[220px] shrink-0 border-t border-[var(--card-border)]">
              <BottomTabs
                tokenId={tokenId}
                conditionId={market?.conditionId ?? null}
                outcomes={outcomes}
              />
            </div>
          </div>

          {/* Right column: Trade + Orderbook */}
          <div className="w-[340px] xl:w-[380px] shrink-0 border-l border-[var(--card-border)] flex flex-col min-h-0">
            {/* Trade panel — auto height, no scroll */}
            <div className="shrink-0">
              <TradePanel
                outcomes={outcomes}
                tokenId={tokenId}
                mappedTokenIds={mappedTokenIds}
                negRisk={clobMarket?.neg_risk ?? false}
                clobMarketLoaded={!clobMarketLoading && !!clobMarket}
                acceptingOrders={clobMarket?.accepting_orders ?? true}
                conditionId={market?.conditionId ?? null}
                tickSize={clobMarket?.minimum_tick_size}
                minOrderSize={clobMarket?.minimum_order_size}
              />
            </div>
            {/* Orderbook — fills remaining height */}
            <div className="flex-1 min-h-0 overflow-hidden border-t border-[var(--card-border)]">
              <OrderbookPanel
                orderbook={orderbook ?? null}
                midpoint={selectedMidpoint ?? null}
                isLoading={orderbookLoading}
                isError={orderbookError}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile layout (below lg) */}
      <div className="lg:hidden h-[calc(100vh-56px)] flex flex-col">
        {/* Compact mobile header */}
        <div className="px-3 py-2 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/50 shrink-0">
          <div className="flex items-start gap-3">
            {market.image && (
              <img src={market.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold leading-tight line-clamp-2">{market.question}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-lg font-bold font-mono">
              {selectedMidpoint != null ? `${(selectedMidpoint * 100).toFixed(1)}c` : '--'}
            </span>
            <div className="flex items-center gap-0.5">
              {(['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const).map((interval) => (
                <button
                  key={interval}
                  onClick={() => setChartInterval(interval)}
                  className={`text-[0.6rem] font-mono px-1.5 py-0.5 rounded transition-colors ${
                    chartInterval === interval
                      ? 'bg-[var(--accent)] text-[var(--background)]'
                      : 'text-muted-foreground hover:text-[var(--foreground)]'
                  }`}
                >
                  {interval.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabbed content */}
        <Tabs defaultValue="chart" className="flex-1 flex flex-col min-h-0">
          <TabsList className="px-3 py-1 border-b border-[var(--card-border)] shrink-0 h-auto justify-start bg-transparent">
            <TabsTrigger value="chart" className="text-xs">Chart</TabsTrigger>
            <TabsTrigger value="trade" className="text-xs">Trade</TabsTrigger>
            <TabsTrigger value="book" className="text-xs">Orderbook</TabsTrigger>
          </TabsList>
          <TabsContent value="chart" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
            <div className="flex-1 min-h-0">
              <CandleChart
                candles={candleData?.candles ?? []}
                isLoading={candlesLoading}
                fillContainer
              />
            </div>
            <div className="h-[200px] border-t border-[var(--card-border)] shrink-0">
              <BottomTabs
                tokenId={tokenId}
                conditionId={market?.conditionId ?? null}
                outcomes={outcomes}
              />
            </div>
          </TabsContent>
          <TabsContent value="trade" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden">
            <TradePanel
              outcomes={outcomes}
              tokenId={tokenId}
              mappedTokenIds={mappedTokenIds}
              negRisk={clobMarket?.neg_risk ?? false}
              clobMarketLoaded={!clobMarketLoading && !!clobMarket}
              acceptingOrders={clobMarket?.accepting_orders ?? true}
              conditionId={market?.conditionId ?? null}
              tickSize={clobMarket?.minimum_tick_size}
              minOrderSize={clobMarket?.minimum_order_size}
            />
          </TabsContent>
          <TabsContent value="book" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
            <OrderbookPanel
              orderbook={orderbook ?? null}
              midpoint={selectedMidpoint ?? null}
              isLoading={orderbookLoading}
              isError={orderbookError}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

/* ============================================================================
 * Loading skeleton
 * ============================================================================ */

function TerminalSkeleton() {
  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/50">
        <div className="w-8 h-8 bg-muted animate-pulse rounded" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
          <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-6 w-16 bg-muted animate-pulse rounded" />
        <div className="flex gap-0.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-7 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>

      {/* Body skeleton — 2 column layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 bg-muted/20 animate-pulse" />
          <div className="h-[220px] shrink-0 border-t border-[var(--card-border)] p-3 space-y-2">
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-muted animate-pulse rounded" />
              <div className="h-6 w-16 bg-muted animate-pulse rounded" />
              <div className="h-6 w-16 bg-muted animate-pulse rounded" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-10 bg-muted animate-pulse rounded" />
                <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
                <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
                <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="w-[340px] xl:w-[380px] shrink-0 border-l border-[var(--card-border)] flex flex-col">
          {/* Trade panel skeleton */}
          <div className="shrink-0 p-3 space-y-3 border-b border-[var(--card-border)]">
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-2 gap-1">
              <div className="h-8 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted animate-pulse rounded" />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="h-8 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-8 w-full bg-muted animate-pulse rounded" />
            <div className="h-8 w-full bg-muted animate-pulse rounded" />
            <div className="h-10 w-full bg-muted animate-pulse rounded" />
          </div>
          {/* Orderbook skeleton */}
          <div className="flex-1 p-3 space-y-1.5">
            <div className="h-4 w-20 bg-muted animate-pulse rounded mb-3" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3.5 w-12 bg-muted animate-pulse rounded" />
                <div className="h-3.5 w-10 bg-muted animate-pulse rounded" />
              </div>
            ))}
            <div className="py-1.5 flex justify-center">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3.5 w-12 bg-muted animate-pulse rounded" />
                <div className="h-3.5 w-10 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
