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
} from '@app/ui';
import {
  useMarket,
  useOrderbook,
  usePriceHistory,
  useTrades,
  useRealtimeOrderbook,
  usePlaceOrder,
} from '@/hooks';
import { useTradingStore, useWalletStore } from '@/stores';
import { calculateOrderEstimate } from '@app/trading';
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

  const tokenId = market?.outcomeTokenIds?.[orderForm.outcomeIndex] ?? null;
  const { data: orderbook, isLoading: orderbookLoading } = useOrderbook(tokenId);
  const { data: trades, isLoading: tradesLoading } = useTrades(tokenId);
  const { data: priceHistory, isLoading: priceHistoryLoading } = usePriceHistory(
    market?.conditionId ?? null,
    chartInterval
  );

  useRealtimeOrderbook(tokenId);

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
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="orderbook" className="mt-0">
                  {orderbookLoading ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      Loading orderbook...
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
                  ) : (
                    <div className="space-y-1 text-sm font-mono">
                      {trades?.slice(0, 15).map((trade, i) => (
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
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <div>
          <TradePanel outcomes={outcomes} tokenId={tokenId} />
        </div>
      </div>
    </div>
  );
}

function TradePanel({ outcomes, tokenId }: { outcomes: OutcomeEntry[]; tokenId: string | null }) {
  const privyAvailable = usePrivyAvailable();

  if (!privyAvailable) {
    return <TradePanelDisabled outcomes={outcomes} />;
  }

  return <TradePanelInner outcomes={outcomes} tokenId={tokenId} />;
}

function TradePanelDisabled({ outcomes }: { outcomes: OutcomeEntry[] }) {
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
            return (
              <Button
                key={outcome.key}
                variant={variant}
                className="w-full"
                onClick={() => useTradingStore.getState().setOrderOutcome(i)}
              >
                {outcome.label}
                <span className="ml-1 opacity-70">
                  {outcome.price != null ? `${(outcome.price * 100).toFixed(0)}c` : '--'}
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

function TradePanelInner({ outcomes, tokenId }: { outcomes: OutcomeEntry[]; tokenId: string | null }) {
  const { orderForm, setOrderSide, setOrderPrice, setOrderSize } = useTradingStore();
  const { isConnected } = useWalletStore();

  const placeOrder = usePlaceOrder({
    onSuccess: (orderId) => {
      console.log('Order placed:', orderId);
    },
    onError: (error) => {
      console.error('Order failed:', error);
    },
  });

  const price = parseFloat(orderForm.price) || 0;
  const size = parseFloat(orderForm.size) || 0;
  const orderEstimate = price > 0 && size > 0 && tokenId
    ? calculateOrderEstimate({
        tokenId,
        side: orderForm.side,
        price,
        size,
      })
    : null;

  const handlePlaceOrder = () => {
    if (!tokenId || !price || !size) return;
    placeOrder.mutate({
      tokenId,
      side: orderForm.side,
      price,
      size,
    });
  };

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
            return (
              <Button
                key={outcome.key}
                variant={variant}
                className="w-full"
                onClick={() => useTradingStore.getState().setOrderOutcome(i)}
              >
                {outcome.label}
                <span className="ml-1 opacity-70">
                  {outcome.price != null ? `${(outcome.price * 100).toFixed(0)}c` : '--'}
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

        <div>
          <label className="text-sm font-medium mb-1.5 block">Shares</label>
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
            <span className="text-muted-foreground">Est. Cost</span>
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
        </div>

        <Button
          className="w-full"
          size="lg"
          variant={orderForm.side === 'BUY' ? 'positive' : 'negative'}
          disabled={!isConnected || !tokenId || !price || !size || placeOrder.isPending}
          onClick={handlePlaceOrder}
        >
          {placeOrder.isPending
            ? 'Placing Order...'
            : isConnected
              ? `${orderForm.side === 'BUY' ? 'Buy' : 'Sell'} ${outcomes[orderForm.outcomeIndex]?.label ?? ''}`
              : 'Connect Wallet to Trade'}
        </Button>

        {placeOrder.error && (
          <p className="text-xs text-negative text-center">{placeOrder.error.message}</p>
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
