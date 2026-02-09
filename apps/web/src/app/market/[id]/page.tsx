'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { CandleChart } from '@/components/candle-chart';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Input,
  Skeleton,
  toast,
} from '@app/ui';
import {
  useMarket,
  useOrderbook,
  useMidpoint,
  useTrades,
  useRealtimeOrderbook,
  usePlaceOrder,
  useUsdcBalance,
  useClobMarket,
  useMarketPositions,
  useConditionalTokenApproval,
  useConditionalTokenBalance,
  useEnableTrading,
  useOpenOrders,
  useCancelOrder,
  useMarketStats,
  useMarketCandles,
} from '@/hooks';
import { useTradingStore, useWalletStore } from '@/stores';
import { calculateOrderEstimate, walkOrderbookDepth } from '@app/trading';
import { buildOutcomeEntries, isYesOutcome, isNoOutcome, type OutcomeEntry } from '@/lib/outcomes';
import { formatVolume } from '@/lib/indexer';
import { usePrivyAvailable } from '@/providers/privy-provider';

type TimeInterval = '1h' | '4h' | '1d' | '1w';

interface MarketPageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Orderbook flash detection: compare current vs previous levels, emit flash map
// ---------------------------------------------------------------------------

type FlashType = 'positive' | 'negative' | 'accent';

interface OrderbookLevel {
  price: number;
  size: number;
}

interface OrderbookSnapshot {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

/**
 * Builds a Map<"bid:idx"|"ask:idx", FlashType> by diffing against the
 * previous orderbook snapshot stored in a ref.
 */
function useOrderbookFlash(orderbook: OrderbookSnapshot | null | undefined) {
  const prevRef = useRef<OrderbookSnapshot | null>(null);
  const flashCounterRef = useRef(0);

  const { flashMap, flashId } = useMemo(() => {
    const map = new Map<string, FlashType>();
    if (!orderbook) {
      return { flashMap: map, flashId: flashCounterRef.current };
    }

    const prev = prevRef.current;

    if (prev) {
      // Compare bids
      const prevBids = prev.bids.slice(0, 8);
      const curBids = orderbook.bids.slice(0, 8);
      for (let i = 0; i < curBids.length; i++) {
        const cur = curBids[i];
        const old = prevBids[i];
        if (!old) {
          // New level appeared
          map.set(`bid:${i}`, 'accent');
        } else if (cur.price !== old.price || cur.size !== old.size) {
          map.set(`bid:${i}`, cur.price > old.price ? 'positive' : cur.price < old.price ? 'negative' : 'positive');
        }
      }

      // Compare asks
      const prevAsks = prev.asks.slice(0, 8);
      const curAsks = orderbook.asks.slice(0, 8);
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

    // Increment counter so keys change, re-triggering CSS animation
    if (map.size > 0) {
      flashCounterRef.current += 1;
    }

    return { flashMap: map, flashId: flashCounterRef.current };
  }, [orderbook]);

  // Update the ref *after* the render uses the diff
  useEffect(() => {
    if (orderbook) {
      prevRef.current = {
        bids: orderbook.bids.slice(0, 8).map((l) => ({ ...l })),
        asks: orderbook.asks.slice(0, 8).map((l) => ({ ...l })),
      };
    }
  }, [orderbook]);

  return { flashMap, flashId };
}

/**
 * Tracks the previous midpoint value and returns a flash direction.
 */
function useMidpointFlash(midpointA: number | null | undefined, midpointB: number | null | undefined) {
  const prevARef = useRef<number | null>(null);
  const prevBRef = useRef<number | null>(null);
  const counterRef = useRef(0);

  const { flashA, flashB, flashMidId } = useMemo(() => {
    let fA: FlashType | null = null;
    let fB: FlashType | null = null;
    let changed = false;

    if (midpointA != null && prevARef.current != null && midpointA !== prevARef.current) {
      fA = midpointA > prevARef.current ? 'positive' : 'negative';
      changed = true;
    }
    if (midpointB != null && prevBRef.current != null && midpointB !== prevBRef.current) {
      fB = midpointB > prevBRef.current ? 'positive' : 'negative';
      changed = true;
    }

    if (changed) counterRef.current += 1;

    return { flashA: fA, flashB: fB, flashMidId: counterRef.current };
  }, [midpointA, midpointB]);

  useEffect(() => {
    if (midpointA != null) prevARef.current = midpointA;
    if (midpointB != null) prevBRef.current = midpointB;
  }, [midpointA, midpointB]);

  return { flashA, flashB, flashMidId };
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

    // Prefer CLOB market token mapping (authoritative outcome ↔ token_id)
    if (clobMarket?.tokens?.length) {
      return outcomes.map((entry, index) => {
        const match = clobMarket.tokens.find((token) =>
          token.outcome?.trim().toLowerCase() === entry.label.trim().toLowerCase()
        );
        return match?.token_id ?? outcomeTokenIds[index];
      });
    }

    // Fallback: try to infer YES/NO mapping from midpoints vs snapshot price
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
  const { data: trades, isLoading: tradesLoading, isError: tradesError } = useTrades(tokenId);
  const { data: candleData, isLoading: candlesLoading } = useMarketCandles(
    market?.conditionId,
    null,
    chartInterval,
  );

  useRealtimeOrderbook(tokenId);

  // Flash detection for orderbook levels and midpoint
  const { flashMap, flashId } = useOrderbookFlash(orderbook);
  const { flashA: midFlashA, flashMidId } = useMidpointFlash(midpointA, midpointB);

  const { data: openOrders, isLoading: ordersLoading } = useOpenOrders();
  const cancelOrder = useCancelOrder({
    onSuccess: (orderId) => {
      toast({ variant: 'success', title: 'Order cancelled', description: `Order ${orderId.slice(0, 8)}...` });
    },
    onError: (error) => {
      toast({ variant: 'error', title: 'Cancel failed', description: error.message });
    },
  });

  if (marketLoading) {
    return (
      <div>
        <span className="sr-only">Loading market data...</span>
        {/* Title area skeleton */}
        <div className="flex gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <div className="flex items-center gap-2 sm:gap-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Chart + tabs column */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-10" />
                ))}
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-16" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-7 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[220px] w-full rounded-lg" />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24 rounded-md" />
                  <Skeleton className="h-9 w-20 rounded-md" />
                  <Skeleton className="h-9 w-20 rounded-md" />
                </div>
              </CardHeader>
              <CardContent>
                <OrderbookSkeleton />
              </CardContent>
            </Card>
          </div>

          {/* Trade panel sidebar skeleton */}
          <div>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-12" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted/50 rounded-md">
                  <Skeleton className="h-9 rounded" />
                  <Skeleton className="h-9 rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-11 rounded-md" />
                  <Skeleton className="h-11 rounded-md" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-11 rounded-md" />
                  <Skeleton className="h-11 rounded-md" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
                <Skeleton className="h-12 w-full rounded-md" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Market not found</h1>
        <p className="text-muted-foreground">The market you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-3 sm:gap-4 mb-4 sm:mb-6">
        {market.image && (
          <img src={market.image} alt="" className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">{market.question}</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
            {market.category && <Badge variant="outline">{market.category}</Badge>}
            <span>{formatVolume(market.volume)} volume</span>
            {market.endDateIso && <span>Ends {new Date(market.endDateIso).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>

      {marketStats?.uniqueTraders != null && (
        <div className="font-mono text-xs text-[var(--foreground-muted)] mb-4 sm:mb-6 flex flex-wrap gap-x-3 gap-y-1">
          <span>Traders: {marketStats.uniqueTraders.toLocaleString()}</span>
          <span className="text-border">|</span>
          <span>On-chain Vol: {formatVolume(marketStats.onChainVolume)}</span>
          <span className="text-border">|</span>
          <span>Trades: {marketStats.totalTrades.toLocaleString()}</span>
          <span className="text-border">|</span>
          <span>Holders: {marketStats.holderCount.toLocaleString()}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-end gap-1 overflow-x-auto">
              {(['1h', '4h', '1d', '1w'] as const).map((interval) => (
                <Button
                  key={interval}
                  variant={chartInterval === interval ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartInterval(interval)}
                  className="text-xs px-2 h-8 min-h-[32px] min-w-[40px] flex-shrink-0"
                >
                  {interval.toUpperCase()}
                </Button>
              ))}
            </div>
            <CandleChart
              candles={candleData?.candles ?? []}
              isLoading={candlesLoading}
              title={outcomes[orderForm.outcomeIndex]?.label ?? 'Price'}
              height={220}
            />
          </div>

          <Card>
            <Tabs defaultValue="orderbook">
              <CardHeader>
                <TabsList>
                  <TabsTrigger value="orderbook">Orderbook</TabsTrigger>
                  <TabsTrigger value="trades">Trades</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="orderbook" className="mt-0">
                  {orderbookLoading ? (
                    <OrderbookSkeleton />
                  ) : orderbookError ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      Failed to load orderbook
                    </div>
                  ) : !orderbook?.bids.length && !orderbook?.asks.length ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      No orderbook data
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-positive mb-2">Bids</div>
                          <div className="space-y-1 text-sm font-mono">
                            {orderbook?.bids.slice(0, 8).map((level, i) => {
                              const flash = flashMap.get(`bid:${i}`);
                              return (
                                <div
                                  key={`bid-${i}-${flash ? flashId : 'stable'}`}
                                  className={`flex justify-between rounded-sm px-1 -mx-1 ${flash ? `flash-${flash}` : ''}`}
                                >
                                  <span className="text-positive">{level.price.toFixed(2)}</span>
                                  <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-negative mb-2">Asks</div>
                          <div className="space-y-1 text-sm font-mono">
                            {orderbook?.asks.slice(0, 8).map((level, i) => {
                              const flash = flashMap.get(`ask:${i}`);
                              return (
                                <div
                                  key={`ask-${i}-${flash ? flashId : 'stable'}`}
                                  className={`flex justify-between rounded-sm px-1 -mx-1 ${flash ? `flash-${flash}` : ''}`}
                                >
                                  <span className="text-negative">{level.price.toFixed(2)}</span>
                                  <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {/* Midpoint display with flash */}
                      {midpointA != null && (
                        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-center gap-4 text-sm font-mono">
                          <span className="text-muted-foreground text-xs">MID</span>
                          <span
                            key={`midA-${midFlashA ? flashMidId : 'stable'}`}
                            className={midFlashA ? `flash-text-${midFlashA}` : ''}
                          >
                            {(midpointA * 100).toFixed(1)}c
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
                <TabsContent value="trades" className="mt-0">
                  {tradesLoading ? (
                    <TradesSkeleton />
                  ) : tradesError ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      Failed to load trades
                    </div>
                  ) : !trades?.length ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      No recent trades
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm font-mono">
                      {trades.slice(0, 15).map((trade, i) => (
                        <div key={i} className="flex justify-between items-center py-1">
                          <Badge variant={trade.side === 'BUY' ? 'positive' : 'negative'} className="text-xs">
                            {trade.side}
                          </Badge>
                          <span>{parseFloat(String(trade.price)).toFixed(2)}</span>
                          <span className="text-muted-foreground">{parseFloat(String(trade.size)).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="orders" className="mt-0">
                  {ordersLoading ? (
                    <OrdersSkeleton />
                  ) : !openOrders || openOrders.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      No open orders
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                      <div className="space-y-1 text-sm font-mono min-w-[480px]">
                        <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground border-b border-border/50 mb-1">
                          <span className="w-14">Side</span>
                          <span className="flex-1">Price</span>
                          <span className="flex-1">Size</span>
                          <span className="flex-1">Filled</span>
                          <span className="flex-1">Time</span>
                          <span className="w-16"></span>
                        </div>
                        {openOrders.map((order: { id: string; side: string; price: string; original_size: string; size_matched: string; created_at: number }) => (
                          <div key={order.id} className="flex items-center gap-3 py-1.5">
                            <Badge
                              variant={order.side === 'BUY' ? 'positive' : 'negative'}
                              className="w-14 justify-center text-xs"
                            >
                              {order.side}
                            </Badge>
                            <span className="flex-1">
                              {(parseFloat(order.price) * 100).toFixed(0)}c
                            </span>
                            <span className="flex-1">
                              {parseFloat(order.original_size).toFixed(2)}
                            </span>
                            <span className="flex-1 text-muted-foreground">
                              {parseFloat(order.size_matched).toFixed(2)}
                            </span>
                            <span className="flex-1 text-muted-foreground text-xs">
                              {new Date(order.created_at * 1000).toLocaleString()}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-16 h-8 min-h-[32px] text-xs text-negative hover:text-negative"
                              disabled={cancelOrder.isPending}
                              onClick={() => cancelOrder.mutate(order.id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <div>
          <TradePanel outcomes={outcomes} tokenId={tokenId} mappedTokenIds={mappedTokenIds} negRisk={clobMarket?.neg_risk ?? false} clobMarketLoaded={!clobMarketLoading && !!clobMarket} acceptingOrders={clobMarket?.accepting_orders ?? true} conditionId={market?.conditionId ?? null} />
        </div>
      </div>
    </div>
  );
}

function TradePanel({
  outcomes,
  tokenId,
  mappedTokenIds,
  negRisk,
  clobMarketLoaded,
  acceptingOrders,
  conditionId,
}: {
  outcomes: OutcomeEntry[];
  tokenId: string | null;
  mappedTokenIds: string[];
  negRisk: boolean;
  clobMarketLoaded: boolean;
  acceptingOrders: boolean;
  conditionId: string | null;
}) {
  const privyAvailable = usePrivyAvailable();
  const { data: orderbook } = useOrderbook(tokenId);

  // Fetch midpoints for all outcomes to show live CLOB prices on buttons
  const { data: midpoint0 } = useMidpoint(mappedTokenIds[0] ?? null);
  const { data: midpoint1 } = useMidpoint(mappedTokenIds[1] ?? null);
  const liveMidpoints = useMemo(
    () => [midpoint0 ?? null, midpoint1 ?? null],
    [midpoint0, midpoint1]
  );

  if (!privyAvailable) {
    return <TradePanelDisabled outcomes={outcomes} liveMidpoints={liveMidpoints} />;
  }

  return (
    <TradePanelInner
      outcomes={outcomes}
      tokenId={tokenId}
      orderbook={orderbook ?? null}
      liveMidpoints={liveMidpoints}
      negRisk={negRisk}
      clobMarketLoaded={clobMarketLoaded}
      acceptingOrders={acceptingOrders}
      conditionId={conditionId}
    />
  );
}

function TradePanelDisabled({
  outcomes,
  liveMidpoints,
}: {
  outcomes: OutcomeEntry[];
  liveMidpoints: (number | null)[];
}) {
  const { orderForm } = useTradingStore();

  return (
    <Card className="sticky top-[6.5rem] sm:top-20">
      <CardHeader>
        <CardTitle className="text-base">Trade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {outcomes.map((outcome, i) => {
            const isSelected = orderForm.outcomeIndex === i;
            const isNo = isNoOutcome(outcome.label);
            const isYes = isYesOutcome(outcome.label);
            const variant = isSelected
              ? isNo
                ? 'negative'
                : isYes
                  ? 'positive'
                  : 'secondary'
              : 'outline';
            // Prefer live CLOB midpoint, fall back to indexer snapshot
            const displayPrice = liveMidpoints[i] ?? outcome.price;
            return (
              <Button
                key={outcome.key}
                variant={variant}
                className="w-full min-h-[44px]"
                onClick={() => useTradingStore.getState().setOrderOutcome(i)}
              >
                {outcome.label}
                <span className="ml-1 opacity-70">
                  {displayPrice != null ? `${(displayPrice * 100).toFixed(0)}c` : '--'}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            HTTPS required for trading
          </p>
          <p className="text-xs text-muted-foreground">
            Wallet connection requires a secure origin
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface ParsedOrderbook {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
}

const MARKET_ORDER_SLIPPAGE = 3; // 3 cents slippage buffer

function TradePanelInner({
  outcomes,
  tokenId,
  orderbook,
  liveMidpoints,
  negRisk,
  clobMarketLoaded,
  acceptingOrders,
  conditionId,
}: {
  outcomes: OutcomeEntry[];
  tokenId: string | null;
  orderbook: ParsedOrderbook | null;
  liveMidpoints: (number | null)[];
  negRisk: boolean;
  clobMarketLoaded: boolean;
  acceptingOrders: boolean;
  conditionId: string | null;
}) {
  const { orderForm, setOrderSide, setOrderPrice, setOrderSize, setOrderMode } = useTradingStore();
  const { isConnected } = useWalletStore();
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [lastOrderResult, setLastOrderResult] = useState<{
    orderId: string;
    side: string;
    size: string;
  } | null>(null);
  const lastOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the success banner after 5 seconds
  useEffect(() => {
    return () => {
      if (lastOrderTimerRef.current) clearTimeout(lastOrderTimerRef.current);
    };
  }, []);

  const {
    balance,
    ctfAllowance,
    negRiskAllowance,
    negRiskAdapterAllowance,
    walletBalance,
    onChainAllowance,
    balanceSource,
    isLoading: balanceLoading,
  } = useUsdcBalance();
  const {
    isApproved: ctfApproved,
    isChecking: ctfApprovalChecking,
  } = useConditionalTokenApproval(negRisk);
  const { enableTrading, isEnabling, error: enableError } = useEnableTrading(negRisk);
  const { data: marketPositions } = useMarketPositions(conditionId);
  const { balance: onChainTokenBalance } = useConditionalTokenBalance(tokenId);

  // Find position for the currently selected outcome
  const selectedPosition = marketPositions?.find(
    (p) => p.outcome_index === orderForm.outcomeIndex
  ) ?? null;

  // Use on-chain token balance as fallback when position data is unavailable
  const sellableSize = selectedPosition?.size ?? (onChainTokenBalance > 0 ? onChainTokenBalance : 0);

  const isMarket = orderForm.mode === 'market';
  const size = parseFloat(orderForm.size) || 0;

  // For market orders, walk orderbook depth instead of just using best level
  const bestAsk = orderbook?.asks[0]?.price ?? 0;
  const bestBid = orderbook?.bids[0]?.price ?? 0;

  const depthResult = useMemo(() => {
    if (!isMarket || size <= 0 || !orderbook) return null;
    const levels = orderForm.side === 'BUY' ? orderbook.asks : orderbook.bids;
    return walkOrderbookDepth(levels, size);
  }, [isMarket, size, orderbook, orderForm.side]);

  // Market price: use average fill price from depth walk, or best level +/- slippage
  // BUY: set price ABOVE market (willing to pay more) to ensure fill
  // SELL: set price BELOW market (willing to accept less) to ensure fill
  const marketPrice = useMemo(() => {
    if (depthResult && depthResult.filledSize >= size) {
      const avgCents = Math.round(depthResult.avgPrice * 100);
      return orderForm.side === 'BUY'
        ? Math.min(avgCents + MARKET_ORDER_SLIPPAGE, 99)
        : Math.max(avgCents - MARKET_ORDER_SLIPPAGE, 1);
    }
    return orderForm.side === 'BUY'
      ? Math.min(Math.round(bestAsk * 100) + MARKET_ORDER_SLIPPAGE, 99)
      : Math.max(Math.round(bestBid * 100) - MARKET_ORDER_SLIPPAGE, 1);
  }, [depthResult, size, bestAsk, bestBid, orderForm.side]);

  const placeOrder = usePlaceOrder({
    onStatusChange: setOrderStatus,
    onSuccess: (orderId) => {
      setOrderStatus(null);
      toast({ variant: 'success', title: 'Order placed', description: `Order ID: ${orderId}` });

      // Show success banner in the trade panel
      setLastOrderResult({
        orderId,
        side: orderForm.side,
        size: orderForm.size,
      });
      // Clear any existing timer
      if (lastOrderTimerRef.current) clearTimeout(lastOrderTimerRef.current);
      lastOrderTimerRef.current = setTimeout(() => {
        setLastOrderResult(null);
        lastOrderTimerRef.current = null;
      }, 5000);
    },
    onError: (error) => {
      setOrderStatus(null);
      toast({ variant: 'error', title: 'Order failed', description: error.message });
    },
  });

  const price = isMarket ? marketPrice : (parseFloat(orderForm.price) || 0);
  const orderEstimate = price > 0 && size > 0 && tokenId
    ? calculateOrderEstimate({
        tokenId,
        side: orderForm.side,
        price,
        size,
      })
    : null;

  const estimatedCost = orderEstimate?.cost ?? 0;
  // For neg-risk: both NegRiskCtfExchange AND NegRiskAdapter need sufficient allowance
  // onChainAllowance only checks regular CTF Exchange, so only use as fallback for non-neg-risk
  const effectiveAllowance = negRisk
    ? Math.min(negRiskAllowance, negRiskAdapterAllowance)
    : Math.max(ctfAllowance, onChainAllowance ?? 0);
  const effectiveBalance = balance > 0 ? balance : (walletBalance ?? balance);
  const needsApproval = isConnected && orderForm.side === 'BUY' && effectiveAllowance < estimatedCost && estimatedCost > 0;
  const needsCTFApproval = isConnected && orderForm.side === 'SELL' && !ctfApproved && !ctfApprovalChecking;
  const insufficientBalance = isConnected && orderForm.side === 'BUY' && effectiveBalance < estimatedCost && estimatedCost > 0;
  const noLiquidity = isMarket && ((orderForm.side === 'BUY' && bestAsk === 0) || (orderForm.side === 'SELL' && bestBid === 0));
  const insufficientPosition = isConnected && orderForm.side === 'SELL' && size > 0 && sellableSize > 0 && size > sellableSize;

  const handlePlaceOrder = () => {
    if (placeOrder.isPending) return;
    if (!tokenId || !price || !size) return;
    placeOrder.mutate({
      tokenId,
      side: orderForm.side,
      price,
      size,
      orderType: 'GTC',
      negRisk,
    });
  };

  return (
    <Card className="sticky top-[6.5rem] sm:top-20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Trade</CardTitle>
          {isConnected && (
            <span className="text-xs text-muted-foreground font-mono text-right">
              {balanceLoading ? '...' : `$${balance.toFixed(2)} USDC`}
              {walletBalance !== undefined && walletBalance !== balance && (
                <span className="block text-[0.65rem] text-muted-foreground">
                  Wallet: ${walletBalance.toFixed(2)}
                  {balanceSource === 'onchain' ? ' (on-chain)' : ''}
                </span>
              )}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Limit / Market toggle */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted/50 rounded-md">
          <button
            className={`text-xs font-mono py-2.5 sm:py-1.5 rounded transition-colors min-h-[44px] sm:min-h-0 ${
              isMarket
                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                : 'text-muted-foreground hover:text-[var(--foreground)]'
            }`}
            onClick={() => setOrderMode('market')}
          >
            Market
          </button>
          <button
            className={`text-xs font-mono py-2.5 sm:py-1.5 rounded transition-colors min-h-[44px] sm:min-h-0 ${
              !isMarket
                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                : 'text-muted-foreground hover:text-[var(--foreground)]'
            }`}
            onClick={() => setOrderMode('limit')}
          >
            Limit
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {outcomes.map((outcome, i) => {
            const isSelected = orderForm.outcomeIndex === i;
            const isNo = isNoOutcome(outcome.label);
            const isYes = isYesOutcome(outcome.label);
            const variant = isSelected
              ? isNo
                ? 'negative'
                : isYes
                  ? 'positive'
                  : 'secondary'
              : 'outline';
            // Prefer live CLOB midpoint, fall back to indexer snapshot
            const displayPrice = liveMidpoints[i] ?? outcome.price;
            return (
              <Button
                key={outcome.key}
                variant={variant}
                className="w-full min-h-[44px]"
                onClick={() => useTradingStore.getState().setOrderOutcome(i)}
              >
                {outcome.label}
                <span className="ml-1 opacity-70">
                  {displayPrice != null ? `${(displayPrice * 100).toFixed(0)}c` : '--'}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={orderForm.side === 'BUY' ? 'positive' : 'outline'}
            onClick={() => setOrderSide('BUY')}
            className="min-h-[44px]"
          >
            Buy
          </Button>
          <Button
            variant={orderForm.side === 'SELL' ? 'negative' : 'outline'}
            onClick={() => setOrderSide('SELL')}
            className="min-h-[44px]"
          >
            Sell
          </Button>
        </div>

        {isMarket ? (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {orderForm.side === 'BUY' ? 'Best Ask' : 'Best Bid'}
              </span>
              <span className="font-mono">
                {noLiquidity
                  ? 'No liquidity'
                  : `${(orderForm.side === 'BUY' ? bestAsk * 100 : bestBid * 100).toFixed(1)}c`}
              </span>
            </div>
            {depthResult && size > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Fill</span>
                <span className="font-mono">
                  {`${(depthResult.avgPrice * 100).toFixed(1)}c`}
                  {depthResult.filledSize < size && (
                    <span className="text-negative ml-1 text-xs">
                      (partial: {depthResult.filledSize.toFixed(0)}/{size.toFixed(0)})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium mb-1.5 block">Price (c)</label>
            <Input
              type="number"
              placeholder="50"
              min="1"
              max="99"
              value={orderForm.price}
              onChange={(e) => setOrderPrice(e.target.value)}
            />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium">Shares</label>
            {orderForm.side === 'BUY' && price > 0 && effectiveBalance > 0 && (() => {
              const reserveUsdc = 0.50;
              const spendable = Math.max(0, effectiveBalance - reserveUsdc);
              const maxShares = Math.floor(spendable / (price / 100));
              return maxShares > 0 ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-[var(--foreground)] font-mono transition-colors"
                  onClick={() => setOrderSize(maxShares.toString())}
                >
                  Max: {maxShares} <span className="text-[var(--accent)]">MAX</span>
                </button>
              ) : null;
            })()}
            {orderForm.side === 'SELL' && sellableSize > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-[var(--foreground)] font-mono transition-colors"
                onClick={() => setOrderSize(sellableSize.toString())}
              >
                Available: {sellableSize.toFixed(2)} <span className="text-[var(--accent)]">MAX</span>
              </button>
            )}
          </div>
          <Input
            type="number"
            placeholder="100"
            min="1"
            value={orderForm.size}
            onChange={(e) => setOrderSize(e.target.value)}
          />
        </div>

        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {orderForm.side === 'SELL' ? 'Est. Proceeds' : 'Est. Cost'}
            </span>
            <span>${orderEstimate?.cost.toFixed(2) ?? '0.00'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Potential Return</span>
            <span className="text-positive">${orderEstimate?.potentialReturn.toFixed(2) ?? '0.00'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max Profit</span>
            <span className="text-positive">${orderEstimate?.potentialPnL.toFixed(2) ?? '0.00'}</span>
          </div>
          {isConnected && insufficientBalance && (
            <div className="flex justify-between pt-1 border-t border-border/50">
              <span className="text-negative">Insufficient balance</span>
              <span className="text-negative">${balance.toFixed(2)} available</span>
            </div>
          )}
          {isConnected && insufficientPosition && (
            <div className="flex justify-between pt-1 border-t border-border/50">
              <span className="text-negative">Insufficient position</span>
              <span className="text-negative">{sellableSize.toFixed(2)} shares available</span>
            </div>
          )}
        </div>

        {/* Your Position */}
        {isConnected && marketPositions && marketPositions.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Position</div>
            {marketPositions.map((pos) => {
              const outcomeLabel = outcomes[pos.outcome_index]?.label ?? `Outcome ${pos.outcome_index}`;
              const pnl = pos.pnl ?? 0;
              return (
                <div key={pos.outcome_index} className="flex items-center justify-between">
                  <div>
                    <span className="font-mono">{pos.size.toFixed(2)}</span>
                    <span className="text-muted-foreground ml-1">{outcomeLabel}</span>
                    {pos.avg_price != null && (
                      <span className="text-muted-foreground text-xs ml-1">@ {(pos.avg_price * 100).toFixed(0)}c</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-mono">${(pos.current_value ?? 0).toFixed(2)}</span>
                    <span className={`ml-1.5 text-xs ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!acceptingOrders ? (
          <>
            <Button className="w-full min-h-[48px]" size="lg" disabled>
              Market Closed
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This market is no longer accepting orders
            </p>
          </>
        ) : (needsApproval || needsCTFApproval) ? (
          <Button
            className="w-full min-h-[48px]"
            size="lg"
            disabled={isEnabling}
            onClick={async () => {
              await enableTrading();
              toast({ variant: 'success', title: 'Trading enabled' });
            }}
          >
            {isEnabling ? 'Enabling Trading...' : 'Enable Trading'}
          </Button>
        ) : (
          <Button
            className="w-full min-h-[48px]"
            size="lg"
            variant={orderForm.side === 'BUY' ? 'positive' : 'negative'}
            disabled={!isConnected || !clobMarketLoaded || !tokenId || !size || placeOrder.isPending || insufficientBalance || insufficientPosition || noLiquidity || (!isMarket && !price)}
            onClick={handlePlaceOrder}
          >
            {placeOrder.isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {orderStatus ?? 'Placing Order...'}
              </span>
            ) : isConnected
              ? `${isMarket ? 'Market ' : ''}${orderForm.side === 'BUY' ? 'Buy' : 'Sell'} ${outcomes[orderForm.outcomeIndex]?.label ?? ''}`
              : 'Connect Wallet to Trade'}
          </Button>
        )}

        {placeOrder.error && (
          <p className="text-xs text-negative text-center">{placeOrder.error.message}</p>
        )}

        {enableError && (
          <p className="text-xs text-negative text-center">{enableError}</p>
        )}

        {lastOrderResult && (
          <div className="flex items-center gap-2 rounded-md bg-positive/10 border border-positive/20 px-3 py-2 text-sm text-positive font-mono animate-in fade-in slide-in-from-top-1 duration-200">
            <svg
              className="h-4 w-4 flex-shrink-0"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="7" />
              <path d="M5 8.5l2 2 4-4" />
            </svg>
            <span>
              Order placed: {lastOrderResult.side} {lastOrderResult.size} shares
            </span>
          </div>
        )}

        {!acceptingOrders ? null : !isConnected && (
          <p className="text-xs text-muted-foreground text-center">
            Connect your wallet to place orders
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton components for loading states
// ---------------------------------------------------------------------------

function OrderbookSkeleton() {
  const widths = ['w-full', 'w-11/12', 'w-10/12', 'w-9/12', 'w-8/12', 'w-7/12', 'w-6/12', 'w-5/12'];
  return (
    <div>
      <span className="sr-only">Loading orderbook...</span>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between mb-2">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
          </div>
          <div className="space-y-1.5">
            {widths.map((w, i) => (
              <div key={i} className="flex justify-between gap-2">
                <Skeleton className="h-5 w-14" />
                <Skeleton className={`h-5 ${w}`} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
          </div>
          <div className="space-y-1.5">
            {widths.map((w, i) => (
              <div key={i} className="flex justify-between gap-2">
                <Skeleton className="h-5 w-14" />
                <Skeleton className={`h-5 ${w}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TradesSkeleton() {
  return (
    <div>
      <span className="sr-only">Loading trades...</span>
      <div className="space-y-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center py-1">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div>
      <span className="sr-only">Loading orders...</span>
      <div className="space-y-1 min-w-[480px]">
        <div className="flex items-center gap-3 py-1 border-b border-border/50 mb-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
