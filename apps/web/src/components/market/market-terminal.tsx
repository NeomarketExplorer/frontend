'use client';

import { useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
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
import { CandleChart } from '@/components/candle-chart';
import { CompactHeader } from '@/components/market/compact-header';
import { TradePanel } from '@/components/market/trade-panel';
import { OrderbookPanel } from '@/components/market/orderbook-panel';
import { BottomTabs } from '@/components/market/bottom-tabs';

type TimeInterval = '1h' | '4h' | '1d' | '1w';

interface MarketTerminalProps {
  id: string;
}

export function MarketTerminal({ id }: MarketTerminalProps) {
  const [chartInterval, setChartInterval] = useState<TimeInterval>('1w');
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

  const sharedProps = {
    outcomes,
    tokenId,
    mappedTokenIds,
    negRisk: clobMarket?.neg_risk ?? false,
    clobMarketLoaded: !clobMarketLoading && !!clobMarket,
    acceptingOrders: clobMarket?.accepting_orders ?? true,
    conditionId: market?.conditionId ?? null,
    candleData,
    candlesLoading,
    orderbook: orderbook ?? null,
    selectedMidpoint: selectedMidpoint ?? null,
    orderbookLoading,
    orderbookError,
    chartInterval,
    onIntervalChange: setChartInterval,
    market,
    marketStats: marketStats ?? null,
  };

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
        <DesktopPanels {...sharedProps} />
      </div>

      {/* Mobile layout (below lg) */}
      <div className="lg:hidden h-[calc(100vh-56px)] flex flex-col">
        <MobileTerminal {...sharedProps} />
      </div>
    </>
  );
}

/* ============================================================================
 * Desktop: 2-column layout with resizable panels
 * ============================================================================ */

interface PanelProps {
  outcomes: ReturnType<typeof buildOutcomeEntries>;
  tokenId: string | null;
  mappedTokenIds: string[];
  negRisk: boolean;
  clobMarketLoaded: boolean;
  acceptingOrders: boolean;
  conditionId: string | null;
  candleData: { candles: import('@/lib/clickhouse').Candle[] } | null | undefined;
  candlesLoading: boolean;
  orderbook: { bids: { price: number; size: number }[]; asks: { price: number; size: number }[] } | null;
  selectedMidpoint: number | null;
  orderbookLoading: boolean;
  orderbookError: boolean;
  chartInterval: TimeInterval;
  onIntervalChange: (interval: TimeInterval) => void;
  market: NonNullable<ReturnType<typeof useMarket>['data']>;
  marketStats: import('@/lib/clickhouse').MarketStats | null;
}

function useClientStorage() {
  const [storage, setStorage] = useState<Storage | undefined>(undefined);
  useEffect(() => { setStorage(localStorage); }, []);
  return storage;
}

function DesktopPanels(props: PanelProps) {
  const storage = useClientStorage();
  const outerLayout = useDefaultLayout({ id: 'market-outer-v2', storage });
  const mainLayout = useDefaultLayout({ id: 'market-main-h2', storage });
  const rightLayout = useDefaultLayout({ id: 'market-right-v2', storage });

  return (
    <Group
      orientation="vertical"
      defaultLayout={outerLayout.defaultLayout}
      onLayoutChanged={outerLayout.onLayoutChanged}
      className="flex-1"
    >
      {/* Main area: chart (left) + orderbook/trade (right) */}
      <Panel id="main" defaultSize={75} minSize={50}>
        <Group
          orientation="horizontal"
          defaultLayout={mainLayout.defaultLayout}
          onLayoutChanged={mainLayout.onLayoutChanged}
        >
          {/* Chart */}
          <Panel id="chart" defaultSize={65} minSize={40} className="overflow-hidden">
            <div className="h-full w-full overflow-hidden">
              <CandleChart
                candles={props.candleData?.candles ?? []}
                isLoading={props.candlesLoading}
                fillContainer
              />
            </div>
          </Panel>
          <Separator />

          {/* Right column: orderbook (top) + trade panel (bottom) */}
          <Panel id="right" defaultSize={35} minSize={22} maxSize={55} className="overflow-hidden">
            <Group
              orientation="vertical"
              defaultLayout={rightLayout.defaultLayout}
              onLayoutChanged={rightLayout.onLayoutChanged}
            >
              <Panel id="orderbook" defaultSize={45} minSize={20} className="overflow-hidden">
                <div className="h-full border-l border-[var(--card-border)] bg-[var(--card)]/50 overflow-hidden">
                  <OrderbookPanel
                    orderbook={props.orderbook}
                    midpoint={props.selectedMidpoint}
                    isLoading={props.orderbookLoading}
                    isError={props.orderbookError}
                  />
                </div>
              </Panel>
              <Separator />
              <Panel id="trade" defaultSize={55} minSize={30} className="overflow-hidden">
                <div className="h-full border-l border-t border-[var(--card-border)] bg-[var(--card)]/50 overflow-hidden">
                  <TradePanel
                    outcomes={props.outcomes}
                    tokenId={props.tokenId}
                    mappedTokenIds={props.mappedTokenIds}
                    negRisk={props.negRisk}
                    clobMarketLoaded={props.clobMarketLoaded}
                    acceptingOrders={props.acceptingOrders}
                    conditionId={props.conditionId}
                  />
                </div>
              </Panel>
            </Group>
          </Panel>
        </Group>
      </Panel>
      <Separator />

      {/* Bottom: full-width tabs */}
      <Panel id="bottom" defaultSize={25} minSize={10} maxSize={45} className="overflow-hidden">
        <div className="h-full border-t border-[var(--card-border)] bg-[var(--card)]/30 overflow-hidden">
          <BottomTabs
            tokenId={props.tokenId}
            conditionId={props.conditionId}
            outcomes={props.outcomes}
          />
        </div>
      </Panel>
    </Group>
  );
}

/* ============================================================================
 * Mobile: tabbed interface
 * ============================================================================ */

function MobileTerminal(props: PanelProps) {
  return (
    <>
      {/* Compact mobile header */}
      <div className="px-3 py-2 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/50">
        <div className="flex items-start gap-3">
          {props.market.image && (
            <img src={props.market.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight line-clamp-2">{props.market.question}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-lg font-bold font-mono">
            {props.selectedMidpoint != null ? `${(props.selectedMidpoint * 100).toFixed(1)}c` : '--'}
          </span>
          <div className="flex items-center gap-0.5">
            {(['1h', '4h', '1d', '1w'] as const).map((interval) => (
              <button
                key={interval}
                onClick={() => props.onIntervalChange(interval)}
                className={`text-[0.6rem] font-mono px-1.5 py-0.5 rounded transition-colors ${
                  props.chartInterval === interval
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
          <TabsTrigger value="book" className="text-xs">Book</TabsTrigger>
        </TabsList>
        <TabsContent value="chart" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
          <div className="flex-1 min-h-0">
            <CandleChart
              candles={props.candleData?.candles ?? []}
              isLoading={props.candlesLoading}
              fillContainer
            />
          </div>
          <div className="h-[200px] border-t border-[var(--card-border)] shrink-0">
            <BottomTabs
              tokenId={props.tokenId}
              conditionId={props.conditionId}
              outcomes={props.outcomes}
            />
          </div>
        </TabsContent>
        <TabsContent value="trade" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden">
          <TradePanel
            outcomes={props.outcomes}
            tokenId={props.tokenId}
            mappedTokenIds={props.mappedTokenIds}
            negRisk={props.negRisk}
            clobMarketLoaded={props.clobMarketLoaded}
            acceptingOrders={props.acceptingOrders}
            conditionId={props.conditionId}
          />
        </TabsContent>
        <TabsContent value="book" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
          <OrderbookPanel
            orderbook={props.orderbook}
            midpoint={props.selectedMidpoint}
            isLoading={props.orderbookLoading}
            isError={props.orderbookError}
          />
        </TabsContent>
      </Tabs>
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

      {/* Body skeleton - 2 column layout */}
      <div className="flex-1 flex">
        {/* Left: Chart area (~65%) */}
        <div className="flex-[65] bg-muted/20 animate-pulse" />

        {/* Right column (~35%) */}
        <div className="flex-[35] border-l border-[var(--card-border)] flex flex-col">
          {/* Orderbook skeleton */}
          <div className="flex-[45] p-3 space-y-1.5 border-b border-[var(--card-border)]">
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
          {/* Trade panel skeleton */}
          <div className="flex-[55] p-3 space-y-3">
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
        </div>
      </div>

      {/* Bottom tabs skeleton */}
      <div className="h-[25%] border-t border-[var(--card-border)] p-3 space-y-2">
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
  );
}
