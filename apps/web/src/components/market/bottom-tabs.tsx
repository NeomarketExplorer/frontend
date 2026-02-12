'use client';

import { Badge, Button, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent, toast } from '@app/ui';
import { useOpenOrders, useCancelOrder, useMarketPositions } from '@/hooks';
import { TradesPanel } from './trades-panel';
import type { OutcomeEntry } from '@/lib/outcomes';

interface BottomTabsProps {
  tokenId: string | null;
  conditionId: string | null;
  outcomes: OutcomeEntry[];
}

export function BottomTabs({ tokenId, conditionId, outcomes }: BottomTabsProps) {
  const { data: openOrders, isLoading: ordersLoading } = useOpenOrders();
  const { data: positions } = useMarketPositions(conditionId);
  const cancelOrder = useCancelOrder({
    onSuccess: (orderId) => {
      toast({ variant: 'success', title: 'Order cancelled', description: `Order ${orderId.slice(0, 8)}...` });
    },
    onError: (error) => {
      toast({ variant: 'error', title: 'Cancel failed', description: error.message });
    },
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="trades" className="h-full flex flex-col">
        <div className="px-3 pt-1 border-b border-[var(--card-border)]">
          <TabsList className="h-8">
            <TabsTrigger value="trades" className="text-xs h-7">Trades</TabsTrigger>
            <TabsTrigger value="positions" className="text-xs h-7">Positions</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs h-7">
              Orders
              {openOrders && openOrders.length > 0 && (
                <span className="ml-1 text-[0.6rem] bg-[var(--accent)] text-[var(--background)] px-1 rounded-full">
                  {openOrders.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="trades" className="flex-1 overflow-hidden mt-0">
          <TradesPanel tokenId={tokenId} />
        </TabsContent>

        <TabsContent value="positions" className="flex-1 overflow-auto mt-0 p-3">
          {!positions || positions.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              No positions in this market
            </div>
          ) : (
            <div className="space-y-1 text-xs font-mono">
              {positions.map((pos) => {
                const label = outcomes[pos.outcome_index]?.label ?? `Outcome ${pos.outcome_index}`;
                const pnl = pos.pnl ?? 0;
                return (
                  <div key={pos.outcome_index} className="flex items-center justify-between py-1">
                    <div>
                      <span>{pos.size.toFixed(2)}</span>
                      <span className="text-muted-foreground ml-1">{label}</span>
                      {pos.avg_price != null && (
                        <span className="text-muted-foreground ml-1">@ {(pos.avg_price * 100).toFixed(0)}c</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span>${(pos.current_value ?? 0).toFixed(2)}</span>
                      <span className={`ml-1.5 ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="flex-1 overflow-auto mt-0 p-3">
          {ordersLoading ? (
            <OrdersSkeleton />
          ) : !openOrders || openOrders.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              No open orders
            </div>
          ) : (
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex items-center gap-2 py-1 text-[0.6rem] text-muted-foreground border-b border-border/50 mb-1">
                <span className="w-10">Side</span>
                <span className="flex-1">Price</span>
                <span className="flex-1">Size</span>
                <span className="flex-1">Filled</span>
                <span className="flex-1">Time</span>
                <span className="w-14"></span>
              </div>
              {openOrders.map((order: { id: string; side: string; price: string; original_size: string; size_matched: string; created_at: number }) => (
                <div key={order.id} className="flex items-center gap-2 py-1">
                  <Badge
                    variant={order.side === 'BUY' ? 'positive' : 'negative'}
                    className="w-10 justify-center text-[0.55rem] px-1 py-0"
                  >
                    {order.side}
                  </Badge>
                  <span className="flex-1">{(parseFloat(order.price) * 100).toFixed(0)}c</span>
                  <span className="flex-1">{parseFloat(order.original_size).toFixed(2)}</span>
                  <span className="flex-1 text-muted-foreground">{parseFloat(order.size_matched).toFixed(2)}</span>
                  <span className="flex-1 text-muted-foreground text-[0.6rem]">
                    {new Date(order.created_at * 1000).toLocaleString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-14 h-6 min-h-0 text-[0.6rem] text-negative hover:text-negative"
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
      </Tabs>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-1.5">
      <span className="sr-only">Loading orders...</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-10 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-14 rounded-md" />
        </div>
      ))}
    </div>
  );
}
