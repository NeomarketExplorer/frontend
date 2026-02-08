'use client';

import { use, useMemo, useState } from 'react';
import { PriceChart } from '@/components/price-chart';
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
  toast,
} from '@app/ui';
import {
  useMarket,
  useOrderbook,
  useMidpoint,
  usePriceHistory,
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
} from '@/hooks';
import { useTradingStore, useWalletStore } from '@/stores';
import { calculateOrderEstimate, walkOrderbookDepth } from '@app/trading';
import { buildOutcomeEntries, isYesOutcome, isNoOutcome, type OutcomeEntry } from '@/lib/outcomes';
import { formatVolume } from '@/lib/indexer';
import { usePrivyAvailable } from '@/providers/privy-provider';

type TimeInterval = '1h' | '6h' | '1d' | '1w' | 'max';

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
  const { data: priceHistory, isLoading: priceHistoryLoading } = usePriceHistory(
    market?.conditionId ?? null,
    chartInterval
  );

  useRealtimeOrderbook(tokenId);

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
        <div className="animate-pulse">
          <div className="h-8 w-1/2 bg-muted rounded mb-4" />
          <div className="h-4 w-3/4 bg-muted rounded mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-muted rounded" />
            <div className="h-96 bg-muted rounded" />
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
      <div className="flex gap-4 mb-6">
        {market.image && (
          <img src={market.image} alt="" className="w-16 h-16 rounded-lg object-cover" />
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold mb-2">{market.question}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {market.category && <Badge variant="outline">{market.category}</Badge>}
            <span>{formatVolume(market.volume)} volume</span>
            {market.endDateIso && <span>Ends {new Date(market.endDateIso).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-end gap-1">
              {(['1h', '6h', '1d', '1w', 'max'] as const).map((interval) => (
                <Button
                  key={interval}
                  variant={chartInterval === interval ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartInterval(interval)}
                  className="text-xs px-2 h-7"
                >
                  {interval.toUpperCase()}
                </Button>
              ))}
            </div>
            <PriceChart
              data={priceHistory ?? []}
              isLoading={priceHistoryLoading}
              title={outcomes[orderForm.outcomeIndex]?.label ?? 'Price'}
              height={280}
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
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      Loading orderbook...
                    </div>
                  ) : orderbookError ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      Failed to load orderbook
                    </div>
                  ) : !orderbook?.bids.length && !orderbook?.asks.length ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      No orderbook data
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-positive mb-2">Bids</div>
                        <div className="space-y-1 text-sm font-mono">
                          {orderbook?.bids.slice(0, 8).map((level, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-positive">{level.price.toFixed(2)}</span>
                              <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-negative mb-2">Asks</div>
                        <div className="space-y-1 text-sm font-mono">
                          {orderbook?.asks.slice(0, 8).map((level, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-negative">{level.price.toFixed(2)}</span>
                              <span className="text-muted-foreground">{level.size.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="trades" className="mt-0">
                  {tradesLoading ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      Loading trades...
                    </div>
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
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      Loading orders...
                    </div>
                  ) : !openOrders || openOrders.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      No open orders
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm font-mono">
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
                            className="w-16 h-7 text-xs text-negative hover:text-negative"
                            disabled={cancelOrder.isPending}
                            onClick={() => cancelOrder.mutate(order.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <div>
          <TradePanel outcomes={outcomes} tokenId={tokenId} mappedTokenIds={mappedTokenIds} negRisk={clobMarket?.neg_risk ?? false} clobMarketLoaded={!clobMarketLoading && !!clobMarket} conditionId={market?.conditionId ?? null} />
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
  conditionId,
}: {
  outcomes: OutcomeEntry[];
  tokenId: string | null;
  mappedTokenIds: string[];
  negRisk: boolean;
  clobMarketLoaded: boolean;
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
    <Card className="sticky top-20">
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
                className="w-full"
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
  conditionId,
}: {
  outcomes: OutcomeEntry[];
  tokenId: string | null;
  orderbook: ParsedOrderbook | null;
  liveMidpoints: (number | null)[];
  negRisk: boolean;
  clobMarketLoaded: boolean;
  conditionId: string | null;
}) {
  const { orderForm, setOrderSide, setOrderPrice, setOrderSize, setOrderMode } = useTradingStore();
  const { isConnected } = useWalletStore();
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
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
    <Card className="sticky top-20">
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
            className={`text-xs font-mono py-1.5 rounded transition-colors ${
              isMarket
                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                : 'text-muted-foreground hover:text-[var(--foreground)]'
            }`}
            onClick={() => setOrderMode('market')}
          >
            Market
          </button>
          <button
            className={`text-xs font-mono py-1.5 rounded transition-colors ${
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
                className="w-full"
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
          >
            Buy
          </Button>
          <Button
            variant={orderForm.side === 'SELL' ? 'negative' : 'outline'}
            onClick={() => setOrderSide('SELL')}
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

        {(needsApproval || needsCTFApproval) ? (
          <Button
            className="w-full"
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
            className="w-full"
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

        {!isConnected && (
          <p className="text-xs text-muted-foreground text-center">
            Connect your wallet to place orders
          </p>
        )}
      </CardContent>
    </Card>
  );
}
