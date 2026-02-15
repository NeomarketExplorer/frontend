'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Input,
  toast,
} from '@app/ui';
import {
  useOrderbook,
  useMidpoint,
  usePlaceOrder,
  useUsdcBalance,
  useConditionalTokenApproval,
  useConditionalTokenBalance,
  useEnableTrading,
  useMarketPositions,
} from '@/hooks';
import { useTradingStore, useWalletStore } from '@/stores';
import {
  calculateOrderEstimate,
  walkOrderbookDepth,
  MIN_ORDER_SHARES,
  DEFAULT_TICK_SIZE,
  tickSizeToCents,
  tickSizePriceDecimals,
  snapToTick,
  type MarketConstraints,
} from '@app/trading';
import { isYesOutcome, isNoOutcome, type OutcomeEntry } from '@/lib/outcomes';
import { usePrivyAvailable } from '@/providers/privy-provider';

interface TradePanelProps {
  outcomes: OutcomeEntry[];
  tokenId: string | null;
  mappedTokenIds: string[];
  negRisk: boolean;
  clobMarketLoaded: boolean;
  acceptingOrders: boolean;
  conditionId: string | null;
  /** CLOB minimum_tick_size (decimal, e.g. 0.01 or 0.001). Falls back to DEFAULT_TICK_SIZE. */
  tickSize?: number;
  /** CLOB minimum_order_size (shares). Falls back to MIN_ORDER_SHARES. */
  minOrderSize?: number;
}

export function TradePanel({
  outcomes,
  tokenId,
  mappedTokenIds,
  negRisk,
  clobMarketLoaded,
  acceptingOrders,
  conditionId,
  tickSize,
  minOrderSize,
}: TradePanelProps) {
  const privyAvailable = usePrivyAvailable();
  const { data: orderbook } = useOrderbook(tokenId);

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
      tickSize={tickSize}
      minOrderSize={minOrderSize}
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
    <div className="h-full overflow-y-auto">
      <div className="p-3">
        <div className="text-sm font-semibold mb-3">Trade</div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {outcomes.map((outcome, i) => {
              const isSelected = orderForm.outcomeIndex === i;
              const isNo = isNoOutcome(outcome.label);
              const isYes = isYesOutcome(outcome.label);
              const variant = isSelected
                ? isNo ? 'negative' : isYes ? 'positive' : 'secondary'
                : 'outline';
              const displayPrice = liveMidpoints[i] ?? outcome.price;
              return (
                <Button
                  key={outcome.key}
                  variant={variant}
                  className="w-full min-h-[36px] text-xs"
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
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">
              HTTPS required for trading
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ParsedOrderbook {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
}

const MARKET_ORDER_SLIPPAGE = 3;

function TradePanelInner({
  outcomes,
  tokenId,
  orderbook,
  liveMidpoints,
  negRisk,
  clobMarketLoaded,
  acceptingOrders,
  conditionId,
  tickSize: tickSizeProp,
  minOrderSize: minOrderSizeProp,
}: {
  outcomes: OutcomeEntry[];
  tokenId: string | null;
  orderbook: ParsedOrderbook | null;
  liveMidpoints: (number | null)[];
  negRisk: boolean;
  clobMarketLoaded: boolean;
  acceptingOrders: boolean;
  conditionId: string | null;
  tickSize?: number;
  minOrderSize?: number;
}) {
  // Per-market constraints (fall back to hardcoded defaults)
  const effectiveTickSize = tickSizeProp ?? DEFAULT_TICK_SIZE;
  const effectiveMinShares = minOrderSizeProp ?? MIN_ORDER_SHARES;
  const tickCents = tickSizeToCents(effectiveTickSize);
  const priceDecimals = tickSizePriceDecimals(effectiveTickSize);
  const priceStep = tickCents; // input step in cents
  const constraints: MarketConstraints = { tickSize: effectiveTickSize, minOrderSize: effectiveMinShares };
  const { orderForm, setOrderSide, setOrderPrice, setOrderSize, setOrderMode } = useTradingStore();
  const { isConnected } = useWalletStore();
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [lastOrderResult, setLastOrderResult] = useState<{
    orderId: string;
    side: string;
    size: string;
  } | null>(null);
  const lastOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const selectedPosition = marketPositions?.find(
    (p) => p.outcome_index === orderForm.outcomeIndex
  ) ?? null;

  const sellableSize = selectedPosition?.size ?? (onChainTokenBalance > 0 ? onChainTokenBalance : 0);
  const sellableMax = Math.floor(sellableSize * 100) / 100; // max 2 decimals (CLOB constraint)

  const isMarket = orderForm.mode === 'market';
  const size = parseFloat(orderForm.size) || 0;

  const bestAsk = orderbook?.asks[0]?.price ?? 0;
  const bestBid = orderbook?.bids[0]?.price ?? 0;

  const depthResult = useMemo(() => {
    if (!isMarket || size <= 0 || !orderbook) return null;
    const levels = orderForm.side === 'BUY' ? orderbook.asks : orderbook.bids;
    return walkOrderbookDepth(levels, size);
  }, [isMarket, size, orderbook, orderForm.side]);

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
      setLastOrderResult({ orderId, side: orderForm.side, size: orderForm.size });
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
    ? calculateOrderEstimate({ tokenId, side: orderForm.side, price, size })
    : null;

  const estimatedCost = orderEstimate?.cost ?? 0;
  const effectiveAllowance = negRisk
    ? Math.min(negRiskAllowance, negRiskAdapterAllowance)
    : Math.max(ctfAllowance, onChainAllowance ?? 0);
  const effectiveBalance = balance > 0 ? balance : (walletBalance ?? balance);
  const needsApproval = isConnected && orderForm.side === 'BUY' && effectiveAllowance < estimatedCost && estimatedCost > 0;
  const needsCTFApproval = isConnected && orderForm.side === 'SELL' && !ctfApproved && !ctfApprovalChecking;
  const insufficientBalance = isConnected && orderForm.side === 'BUY' && effectiveBalance < estimatedCost && estimatedCost > 0;
  const noLiquidity = isMarket && ((orderForm.side === 'BUY' && bestAsk === 0) || (orderForm.side === 'SELL' && bestBid === 0));
  const insufficientPosition = isConnected && orderForm.side === 'SELL' && size > 0 && sellableSize > 0 && size > sellableSize;
  const belowMinSize = isConnected && size > 0 && size < effectiveMinShares;

  const handlePlaceOrder = () => {
    if (placeOrder.isPending) return;
    if (!tokenId || !price || !size) return;
    placeOrder.mutate({ tokenId, side: orderForm.side, price, size, orderType: 'GTC', negRisk, constraints });
  };

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-[var(--card-border)] flex items-center justify-between">
        <span className="text-sm font-semibold">Trade</span>
        {isConnected && (
          <span className="text-[0.65rem] text-muted-foreground font-mono text-right">
            {balanceLoading ? '...' : `$${balance.toFixed(2)} USDC`}
            {walletBalance !== undefined && walletBalance !== balance && (
              <span className="block text-[0.6rem]">
                Wallet: ${walletBalance.toFixed(2)}
                {balanceSource === 'onchain' ? ' (on-chain)' : ''}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
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

        <div className="grid grid-cols-2 gap-1.5">
          {outcomes.map((outcome, i) => {
            const isSelected = orderForm.outcomeIndex === i;
            const isNo = isNoOutcome(outcome.label);
            const isYes = isYesOutcome(outcome.label);
            const variant = isSelected
              ? isNo ? 'negative' : isYes ? 'positive' : 'secondary'
              : 'outline';
            const displayPrice = liveMidpoints[i] ?? outcome.price;
            return (
              <Button
                key={outcome.key}
                variant={variant}
                className="w-full min-h-[36px] text-xs"
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

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant={orderForm.side === 'BUY' ? 'positive' : 'outline'}
            onClick={() => setOrderSide('BUY')}
            className="min-h-[36px] text-xs"
          >
            Buy
          </Button>
          <Button
            variant={orderForm.side === 'SELL' ? 'negative' : 'outline'}
            onClick={() => setOrderSide('SELL')}
            className="min-h-[36px] text-xs"
          >
            Sell
          </Button>
        </div>

        {isMarket ? (
          <div className="bg-muted/50 rounded-lg p-2 space-y-1 text-xs">
            <div className="flex justify-between">
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Fill</span>
                <span className="font-mono">
                  {`${(depthResult.avgPrice * 100).toFixed(1)}c`}
                  {depthResult.filledSize < size && (
                    <span className="text-negative ml-1">
                      (partial: {depthResult.filledSize.toFixed(0)}/{size.toFixed(0)})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium mb-1 block">
              Price ({priceDecimals === 0 ? 'c' : `${tickCents}c step`})
            </label>
            <Input
              type="number"
              placeholder={priceDecimals === 0 ? '50' : '50.0'}
              min={String(tickCents)}
              max="99"
              step={String(priceStep)}
              value={orderForm.price}
              onChange={(e) => setOrderPrice(e.target.value)}
              onBlur={() => {
                const raw = parseFloat(orderForm.price);
                if (!Number.isFinite(raw) || raw <= 0) return;
                const snapped = snapToTick(raw, effectiveTickSize);
                const clamped = Math.max(tickCents, Math.min(99, snapped));
                setOrderPrice(clamped.toFixed(priceDecimals));
              }}
              className="h-8 text-xs"
            />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium">Shares</label>
            {orderForm.side === 'BUY' && price > 0 && effectiveBalance > 0 && (() => {
              const reserveUsdc = 0.50;
              const spendable = Math.max(0, effectiveBalance - reserveUsdc);
              const maxShares = Math.floor(spendable / (price / 100));
              return maxShares > 0 ? (
                <button
                  type="button"
                  className="text-[0.65rem] text-muted-foreground hover:text-[var(--foreground)] font-mono transition-colors"
                  onClick={() => setOrderSize(maxShares.toString())}
                >
                  Max: {maxShares} <span className="text-[var(--accent)]">MAX</span>
                </button>
              ) : null;
            })()}
            {orderForm.side === 'SELL' && sellableSize > 0 && (
              <button
                type="button"
                className="text-[0.65rem] text-muted-foreground hover:text-[var(--foreground)] font-mono transition-colors"
                onClick={() => setOrderSize(sellableMax.toFixed(2))}
              >
                {sellableMax.toFixed(2)} <span className="text-[var(--accent)]">MAX</span>
              </button>
            )}
          </div>
          <Input
            type="number"
            placeholder="100"
            min={String(effectiveMinShares)}
            step="0.01"
            value={orderForm.size}
            onChange={(e) => setOrderSize(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-[0.65rem] text-muted-foreground">
              Min: {effectiveMinShares} shares
            </span>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-2 text-xs space-y-1">
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
              <span className="text-negative">${balance.toFixed(2)}</span>
            </div>
          )}
          {isConnected && insufficientPosition && (
            <div className="flex justify-between pt-1 border-t border-border/50">
              <span className="text-negative">Insufficient position</span>
              <span className="text-negative">{sellableSize.toFixed(2)} shares</span>
            </div>
          )}
          {isConnected && belowMinSize && (
            <div className="flex justify-between pt-1 border-t border-border/50">
              <span className="text-negative">Order too small</span>
              <span className="text-negative">Min {effectiveMinShares} shares</span>
            </div>
          )}
        </div>

        {/* Position */}
        {isConnected && marketPositions && marketPositions.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-2 text-xs space-y-1">
            <div className="text-[0.6rem] font-medium text-muted-foreground uppercase tracking-wider">Your Position</div>
            {marketPositions.map((pos) => {
              const outcomeLabel = outcomes[pos.outcome_index]?.label ?? `Outcome ${pos.outcome_index}`;
              const pnl = pos.pnl ?? 0;
              return (
                <div key={pos.outcome_index} className="flex items-center justify-between">
                  <div>
                    <span className="font-mono">{pos.size.toFixed(2)}</span>
                    <span className="text-muted-foreground ml-1">{outcomeLabel}</span>
                    {pos.avg_price != null && (
                      <span className="text-muted-foreground ml-1">@ {(pos.avg_price * 100).toFixed(0)}c</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-mono">${(pos.current_value ?? 0).toFixed(2)}</span>
                    <span className={`ml-1 ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
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
            <Button className="w-full min-h-[40px] text-xs" size="lg" disabled>
              Market Closed
            </Button>
            <p className="text-[0.65rem] text-muted-foreground text-center">
              This market is no longer accepting orders
            </p>
          </>
        ) : (needsApproval || needsCTFApproval) ? (
          <Button
            className="w-full min-h-[40px] text-xs"
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
            className="w-full min-h-[40px] text-xs"
            size="lg"
            variant={orderForm.side === 'BUY' ? 'positive' : 'negative'}
            disabled={!isConnected || !clobMarketLoaded || !tokenId || !size || placeOrder.isPending || insufficientBalance || insufficientPosition || belowMinSize || noLiquidity || (!isMarket && !price)}
            onClick={handlePlaceOrder}
          >
            {placeOrder.isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {orderStatus ?? 'Placing...'}
              </span>
            ) : isConnected
              ? `${isMarket ? 'Market ' : ''}${orderForm.side === 'BUY' ? 'Buy' : 'Sell'} ${outcomes[orderForm.outcomeIndex]?.label ?? ''}`
              : 'Connect Wallet'}
          </Button>
        )}

        {placeOrder.error && (
          <p className="text-[0.65rem] text-negative text-center">{placeOrder.error.message}</p>
        )}
        {enableError && (
          <p className="text-[0.65rem] text-negative text-center">{enableError}</p>
        )}

        {lastOrderResult && (
          <div className="flex items-center gap-2 rounded-md bg-positive/10 border border-positive/20 px-2 py-1.5 text-xs text-positive font-mono">
            <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="7" />
              <path d="M5 8.5l2 2 4-4" />
            </svg>
            <span>{lastOrderResult.side} {lastOrderResult.size} shares</span>
          </div>
        )}

        {!acceptingOrders ? null : !isConnected && (
          <p className="text-[0.65rem] text-muted-foreground text-center">
            Connect your wallet to place orders
          </p>
        )}
      </div>
    </div>
  );
}
