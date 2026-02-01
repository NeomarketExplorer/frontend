'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ConnectButton } from '@/components/connect-button';
import { AuthGuard } from '@/components/auth-guard';
import { toast } from '@app/ui';
import { usePortfolio, usePositions, useActivity, useOpenOrders, useCancelOrder, type EnrichedPosition } from '@/hooks';
import { useWalletStore } from '@/stores';

export default function PortfolioPage() {
  const { isConnected, address, usdcBalance } = useWalletStore();
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio();
  const { data: positions, isLoading: positionsLoading } = usePositions();
  const { data: activity, isLoading: activityLoading } = useActivity(20);

  return (
    <AuthGuard
      title="Portfolio"
      description="Connect your wallet to view your positions, P&L, and trade history."
      fallback={<PortfolioConnectPrompt />}
    >
      {isConnected && address ? (
        <PortfolioContent
          address={address}
          usdcBalance={usdcBalance}
          portfolio={portfolio}
          portfolioLoading={portfolioLoading}
          positions={positions}
          positionsLoading={positionsLoading}
          activity={activity}
          activityLoading={activityLoading}
        />
      ) : null}
    </AuthGuard>
  );
}

function PortfolioConnectPrompt() {
  return (
    <div className="py-16">
      <div className="text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-[var(--card)] flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-[var(--foreground-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-3">Portfolio</h1>
        <p className="text-sm text-[var(--foreground-muted)] mb-6 font-mono">
          Connect your wallet to view your positions, P&amp;L, and trade history.
        </p>
        <ConnectButton />
      </div>
    </div>
  );
}

type TabId = 'positions' | 'activity' | 'orders';

function PortfolioContent({
  address,
  usdcBalance,
  portfolio,
  portfolioLoading,
  positions,
  positionsLoading,
  activity,
  activityLoading,
}: {
  address: string;
  usdcBalance: number;
  portfolio: ReturnType<typeof usePortfolio>['data'];
  portfolioLoading: boolean;
  positions: ReturnType<typeof usePositions>['data'];
  positionsLoading: boolean;
  activity: ReturnType<typeof useActivity>['data'];
  activityLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('positions');
  const { data: openOrders, isLoading: ordersLoading } = useOpenOrders();
  const cancelOrder = useCancelOrder({
    onSuccess: (orderId) => {
      toast({ variant: 'success', title: 'Order cancelled', description: `Order ${orderId.slice(0, 8)}...` });
    },
    onError: (error) => {
      toast({ variant: 'error', title: 'Cancel failed', description: error.message });
    },
  });

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'positions', label: 'Positions', count: positions?.length },
    { id: 'activity', label: 'Activity' },
    { id: 'orders', label: 'Orders', count: openOrders?.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Portfolio</h1>
        <span className="font-mono text-xs text-[var(--foreground-muted)]">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="USDC Balance"
          loading={portfolioLoading}
          value={`$${usdcBalance.toFixed(2)}`}
          color="var(--accent)"
        />
        <SummaryCard
          label="Portfolio Value"
          loading={portfolioLoading}
          value={`$${portfolio?.totalValue?.toFixed(2) ?? '0.00'}`}
          color="var(--accent)"
        />
        <SummaryCard
          label="Total P&L"
          loading={portfolioLoading}
          value={`${(portfolio?.totalPnL ?? 0) >= 0 ? '+' : ''}$${portfolio?.totalPnL?.toFixed(2) ?? '0.00'}`}
          color={(portfolio?.totalPnL ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)'}
        />
        <SummaryCard
          label="Open Positions"
          loading={positionsLoading}
          value={String(positions?.length ?? 0)}
          color="var(--foreground)"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn ${activeTab === tab.id ? 'btn-ghost active' : 'btn-ghost'}`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="ml-1.5 font-mono text-[0.6rem] text-[var(--foreground-muted)]">
                ({tab.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'positions' && (
        <PositionsTab positions={positions} loading={positionsLoading} />
      )}
      {activeTab === 'activity' && (
        <ActivityTab activity={activity} loading={activityLoading} />
      )}
      {activeTab === 'orders' && (
        <OrdersTab
          orders={openOrders}
          loading={ordersLoading}
          cancelOrder={cancelOrder}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  loading,
  color,
}: {
  label: string;
  value: string;
  loading: boolean;
  color: string;
}) {
  return (
    <div className="glass-card p-4">
      <p className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider mb-1">
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-20 bg-[var(--card-border)] animate-pulse" />
      ) : (
        <p className="font-mono font-bold text-lg" style={{ color }}>
          {value}
        </p>
      )}
    </div>
  );
}

function PositionsTab({
  positions,
  loading,
}: {
  positions: EnrichedPosition[] | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-48 bg-[var(--card-border)]" />
                <div className="h-3 w-32 bg-[var(--card-border)]" />
              </div>
              <div className="h-5 w-16 bg-[var(--card-border)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="glass-card p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--card)] mb-4">
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-[var(--foreground-muted)]" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
        </div>
        <p className="font-mono text-sm text-[var(--foreground-muted)] mb-4">No open positions yet.</p>
        <Link href="/markets" className="btn btn-primary">
          Browse Markets
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">Market</th>
              <th className="text-center w-16">Side</th>
              <th className="text-right w-24">Shares</th>
              <th className="text-right w-24">Avg Price</th>
              <th className="text-right w-24">Value</th>
              <th className="text-right w-20">P&L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, i) => {
              const isYes = position.outcomeName.toLowerCase() === 'yes';
              const pnlPct = position.pnl_percent ?? 0;
              const pnlPositive = pnlPct >= 0;
              const marketLink = position.marketId
                ? `/market/${position.marketId}`
                : null;

              const row = (
                <tr
                  key={i}
                  className="market-row-item animate-fade-up group"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <td>
                    <span className="line-clamp-2 text-sm font-medium group-hover:text-[var(--accent)] transition-colors">
                      {position.marketQuestion ?? `${position.condition_id.slice(0, 10)}...${position.condition_id.slice(-6)}`}
                    </span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`tag ${isYes ? 'tag-success' : 'tag-danger'}`}
                    >
                      {position.outcomeName}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="font-mono text-sm">
                      {position.size.toFixed(2)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="font-mono text-sm text-[var(--foreground-muted)]">
                      ${(position.avg_price ?? 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="font-mono text-sm font-bold">
                      ${position.current_value?.toFixed(2) ?? '0.00'}
                    </span>
                  </td>
                  <td className="text-right">
                    <span
                      className={`font-mono text-xs font-bold ${pnlPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
                    >
                      {pnlPositive ? '+' : ''}{pnlPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );

              return marketLink ? (
                <Link key={i} href={marketLink} className="contents">
                  {row}
                </Link>
              ) : row;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivityTab({
  activity,
  loading,
}: {
  activity: ReturnType<typeof useActivity>['data'];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="glass-card p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="h-5 w-12 bg-[var(--card-border)]" />
              <div className="h-4 w-32 bg-[var(--card-border)]" />
            </div>
            <div className="h-4 w-24 bg-[var(--card-border)]" />
          </div>
        ))}
      </div>
    );
  }

  if (!activity || activity.length === 0) {
    return (
      <div className="glass-card p-10 text-center">
        <p className="font-mono text-sm text-[var(--foreground-muted)]">No trading activity yet.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left w-16">Side</th>
              <th className="text-left">Type</th>
              <th className="text-right w-24">Size</th>
              <th className="text-right w-24">Price</th>
              <th className="text-right w-24">Value</th>
              <th className="text-right w-36">Time</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((item, i) => (
              <tr
                key={i}
                className="market-row-item animate-fade-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <td>
                  <span className={`tag ${item.side === 'BUY' ? 'tag-success' : 'tag-danger'}`}>
                    {item.side ?? item.type.toUpperCase()}
                  </span>
                </td>
                <td>
                  <span className="text-sm capitalize">{item.type}</span>
                  {item.size != null && item.price != null && (
                    <span className="block font-mono text-[0.65rem] text-[var(--foreground-muted)]">
                      {item.size.toFixed(2)} @ {(item.price * 100).toFixed(0)}c
                    </span>
                  )}
                </td>
                <td className="text-right">
                  <span className="font-mono text-sm">
                    {item.size?.toFixed(2) ?? '-'}
                  </span>
                </td>
                <td className="text-right">
                  <span className="font-mono text-sm text-[var(--foreground-muted)]">
                    {item.price != null ? `${(item.price * 100).toFixed(0)}c` : '-'}
                  </span>
                </td>
                <td className="text-right">
                  <span className="font-mono text-sm">
                    {item.value != null ? `$${item.value.toFixed(2)}` : '-'}
                  </span>
                </td>
                <td className="text-right">
                  <span className="font-mono text-[0.65rem] text-[var(--foreground-muted)]">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersTab({
  orders,
  loading,
  cancelOrder,
}: {
  orders: ReturnType<typeof useOpenOrders>['data'];
  loading: boolean;
  cancelOrder: ReturnType<typeof useCancelOrder>;
}) {
  if (loading) {
    return (
      <div className="glass-card p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-center justify-between py-2">
            <div className="space-y-2">
              <div className="h-4 w-48 bg-[var(--card-border)]" />
              <div className="h-3 w-32 bg-[var(--card-border)]" />
            </div>
            <div className="h-5 w-16 bg-[var(--card-border)]" />
          </div>
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="glass-card p-10 text-center">
        <p className="font-mono text-sm text-[var(--foreground-muted)] mb-4">No open orders.</p>
        <Link href="/markets" className="btn btn-primary">
          Browse Markets
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left w-16">Side</th>
              <th className="text-right w-20">Price</th>
              <th className="text-right w-20">Size</th>
              <th className="text-right w-20">Filled</th>
              <th className="text-right w-36">Created</th>
              <th className="text-right w-20"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order: { id: string; side: string; price: string; original_size: string; size_matched: string; created_at: number }) => (
              <tr key={order.id} className="market-row-item">
                <td>
                  <span className={`tag ${order.side === 'BUY' ? 'tag-success' : 'tag-danger'}`}>
                    {order.side}
                  </span>
                </td>
                <td className="text-right">
                  <span className="font-mono text-sm">
                    {(parseFloat(order.price) * 100).toFixed(0)}c
                  </span>
                </td>
                <td className="text-right">
                  <span className="font-mono text-sm">
                    {parseFloat(order.original_size).toFixed(2)}
                  </span>
                </td>
                <td className="text-right">
                  <span className="font-mono text-sm text-[var(--foreground-muted)]">
                    {parseFloat(order.size_matched).toFixed(2)}
                  </span>
                </td>
                <td className="text-right">
                  <span className="font-mono text-[0.65rem] text-[var(--foreground-muted)]">
                    {new Date(order.created_at * 1000).toLocaleString()}
                  </span>
                </td>
                <td className="text-right">
                  <button
                    className="btn btn-ghost font-mono text-xs text-[var(--danger)] hover:text-[var(--danger)]"
                    disabled={cancelOrder.isPending}
                    onClick={() => {
                      if (window.confirm('Cancel this order?')) {
                        cancelOrder.mutate(order.id);
                      }
                    }}
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
