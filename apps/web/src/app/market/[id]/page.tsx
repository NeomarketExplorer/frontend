'use client';

import { use, useMemo, useState } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { Skeleton } from '@app/ui';
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

interface MarketPageProps {
  params: Promise<{ id: string }>;
}

export default function MarketPage({ params }: MarketPageProps) {
  const { id } = use(params);
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
        const match = clobMarket.tokens.find((token) =>
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

  // Current midpoint for the selected outcome
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
      <div className="hidden lg:flex flex-col h-[calc(100vh-56px)]">
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

        <HorizontalPanels
          outcomes={outcomes}
          tokenId={tokenId}
          mappedTokenIds={mappedTokenIds}
          negRisk={clobMarket?.neg_risk ?? false}
          clobMarketLoaded={!clobMarketLoading && !!clobMarket}
          acceptingOrders={clobMarket?.accepting_orders ?? true}
          conditionId={market?.conditionId ?? null}
          candleData={candleData}
          candlesLoading={candlesLoading}
          orderbook={orderbook}
          selectedMidpoint={selectedMidpoint}
          orderbookLoading={orderbookLoading}
          orderbookError={orderbookError}
        />
      </div>

      {/* Mobile layout (below lg) */}
      <div className="lg:hidden px-4 pb-6">
        {/* Compact mobile header */}
        <div className="py-3 space-y-2">
          <div className="flex items-start gap-3">
            {market.image && (
              <img src={market.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold leading-tight">{market.question}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold font-mono">
              {selectedMidpoint != null ? `${(selectedMidpoint * 100).toFixed(1)}c` : '--'}
            </span>
            <div className="flex items-center gap-0.5">
              {(['1h', '4h', '1d', '1w'] as const).map((interval) => (
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

        {/* Chart */}
        <div className="h-[280px] mb-4">
          <CandleChart
            candles={candleData?.candles ?? []}
            isLoading={candlesLoading}
            fillContainer
          />
        </div>

        {/* Orderbook (compact) */}
        <div className="h-[320px] mb-4 border border-[var(--card-border)] bg-[var(--card)]/50">
          <OrderbookPanel
            orderbook={orderbook}
            midpoint={selectedMidpoint}
            isLoading={orderbookLoading}
            isError={orderbookError}
          />
        </div>

        {/* Trade Panel */}
        <div className="border border-[var(--card-border)] bg-[var(--card)]/50 mb-4">
          <TradePanel
            outcomes={outcomes}
            tokenId={tokenId}
            mappedTokenIds={mappedTokenIds}
            negRisk={clobMarket?.neg_risk ?? false}
            clobMarketLoaded={!clobMarketLoading && !!clobMarket}
            acceptingOrders={clobMarket?.accepting_orders ?? true}
            conditionId={market?.conditionId ?? null}
          />
        </div>

        {/* Bottom tabs */}
        <div className="h-[400px] border border-[var(--card-border)] bg-[var(--card)]/30">
          <BottomTabs
            tokenId={tokenId}
            conditionId={market?.conditionId ?? null}
            outcomes={outcomes}
          />
        </div>
      </div>
    </>
  );
}

// Extracted panel components so useDefaultLayout hooks can be called at the top level

interface HorizontalPanelsProps {
  outcomes: ReturnType<typeof buildOutcomeEntries>;
  tokenId: string | null;
  mappedTokenIds: string[];
  negRisk: boolean;
  clobMarketLoaded: boolean;
  acceptingOrders: boolean;
  conditionId: string | null;
  candleData: { candles: import('@/lib/clickhouse').Candle[] } | null | undefined;
  candlesLoading: boolean;
  orderbook: { bids: { price: number; size: number }[]; asks: { price: number; size: number }[] } | null | undefined;
  selectedMidpoint: number | null | undefined;
  orderbookLoading: boolean;
  orderbookError: boolean;
}

function HorizontalPanels(props: HorizontalPanelsProps) {
  const hLayout = useDefaultLayout({ id: 'market-h', storage: typeof window !== 'undefined' ? localStorage : undefined });
  const vLayout = useDefaultLayout({ id: 'market-v', storage: typeof window !== 'undefined' ? localStorage : undefined });

  return (
    <Group
      orientation="horizontal"
      defaultLayout={hLayout.defaultLayout}
      onLayoutChanged={hLayout.onLayoutChanged}
      className="flex-1"
    >
      {/* Left: Trade Panel */}
      <Panel id="trade" defaultSize={18} minSize={14} maxSize={28}>
        <div className="h-full border-r border-[var(--card-border)] bg-[var(--card)]/50">
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
      <Separator />

      {/* Center: Chart + Bottom Tabs */}
      <Panel id="center" defaultSize={58} minSize={35}>
        <Group
          orientation="vertical"
          defaultLayout={vLayout.defaultLayout}
          onLayoutChanged={vLayout.onLayoutChanged}
        >
          <Panel id="chart" defaultSize={65} minSize={30}>
            <div className="h-full">
              <CandleChart
                candles={props.candleData?.candles ?? []}
                isLoading={props.candlesLoading}
                fillContainer
              />
            </div>
          </Panel>
          <Separator />
          <Panel id="bottom-tabs" defaultSize={35} minSize={15}>
            <div className="h-full border-t border-[var(--card-border)] bg-[var(--card)]/30">
              <BottomTabs
                tokenId={props.tokenId}
                conditionId={props.conditionId}
                outcomes={props.outcomes}
              />
            </div>
          </Panel>
        </Group>
      </Panel>
      <Separator />

      {/* Right: Orderbook */}
      <Panel id="orderbook" defaultSize={24} minSize={16} maxSize={35}>
        <div className="h-full border-l border-[var(--card-border)] bg-[var(--card)]/50">
          <OrderbookPanel
            orderbook={props.orderbook}
            midpoint={props.selectedMidpoint}
            isLoading={props.orderbookLoading}
            isError={props.orderbookError}
          />
        </div>
      </Panel>
    </Group>
  );
}

function TerminalSkeleton() {
  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/50">
        <Skeleton className="w-8 h-8 rounded" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-6 w-16" />
        <div className="flex gap-0.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-7" />
          ))}
        </div>
      </div>

      {/* Body skeleton */}
      <div className="flex-1 flex">
        {/* Left panel */}
        <div className="w-[18%] border-r border-[var(--card-border)] p-3 space-y-3">
          <Skeleton className="h-4 w-12" />
          <div className="grid grid-cols-2 gap-1">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Center panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex-[65] border-b border-[var(--card-border)]">
            <Skeleton className="w-full h-full" />
          </div>
          <div className="flex-[35] p-3 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[24%] border-l border-[var(--card-border)] p-3 space-y-1.5">
          <Skeleton className="h-4 w-20 mb-3" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          ))}
          <div className="py-1.5 flex justify-center">
            <Skeleton className="h-4 w-16" />
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
