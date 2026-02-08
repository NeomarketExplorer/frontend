'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ConnectButton } from '@/components/connect-button';
import { AuthGuard } from '@/components/auth-guard';
import { PortfolioChart } from '@/components/portfolio-chart';
import { Skeleton, toast } from '@app/ui';
import { usePortfolio, usePositions, useResolvedPositions, useActivity, useOpenOrders, useCancelOrder, type EnrichedPosition } from '@/hooks';
import { useWalletStore } from '@/stores';

export default function PortfolioPage() {
  const { isConnected, address, usdcBalance } = useWalletStore();
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio();
  const { data: positions, isLoading: positionsLoading } = usePositions();
  const { data: activity, isLoading: activityLoading } = useActivity(50);

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

      {/* Portfolio Value Chart */}
      {!activityLoading && (
        <PortfolioChart
          activities={activity ?? []}
          currentValue={portfolio?.totalValue ?? 0}
        />
      )}

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
        <Skeleton className="h-7 w-20" />
      ) : (
        <p className="font-mono font-bold text-lg" style={{ color }}>
          {value}
        </p>
      )}
    </div>
  );
}

type PositionSubTab = 'open' | 'resolved';

function PositionsTab({
  positions,
  loading,
}: {
  positions: EnrichedPosition[] | undefined;
  loading: boolean;
}) {
  const [subTab, setSubTab] = useState<PositionSubTab>('open');
  const { data: resolvedPositions, isLoading: resolvedLoading } = useResolvedPositions();

  return (
    <div className="space-y-4">
      {/* Sub-tab toggle: Open / Resolved */}
      <div className="flex items-center gap-1 p-0.5 bg-[var(--card)] w-fit">
        <button
          onClick={() => setSubTab('open')}
          className={`font-mono text-xs px-3 py-1.5 transition-colors ${
            subTab === 'open'
              ? 'bg-[var(--accent)] text-[var(--background)] font-bold'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Open
          {positions && positions.length > 0 && (
            <span className="ml-1.5 opacity-70">({positions.length})</span>
          )}
        </button>
        <button
          onClick={() => setSubTab('resolved')}
          className={`font-mono text-xs px-3 py-1.5 transition-colors ${
            subTab === 'resolved'
              ? 'bg-[var(--accent)] text-[var(--background)] font-bold'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Resolved
          {resolvedPositions && resolvedPositions.length > 0 && (
            <span className="ml-1.5 opacity-70">({resolvedPositions.length})</span>
          )}
        </button>
      </div>

      {subTab === 'open' ? (
        <OpenPositionsTable positions={positions} loading={loading} />
      ) : (
        <ResolvedPositionsTable positions={resolvedPositions} loading={resolvedLoading} />
      )}
    </div>
  );
}

function PositionsLoadingSkeleton() {
  return (
    <div className="glass-card overflow-hidden">
      <span className="sr-only">Loading positions...</span>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left"><Skeleton className="h-3 w-14" /></th>
              <th className="text-center w-16"><Skeleton className="h-3 w-10 mx-auto" /></th>
              <th className="text-right w-24"><Skeleton className="h-3 w-12 ml-auto" /></th>
              <th className="text-right w-24"><Skeleton className="h-3 w-16 ml-auto" /></th>
              <th className="text-right w-24"><Skeleton className="h-3 w-12 ml-auto" /></th>
              <th className="text-right w-20"><Skeleton className="h-3 w-10 ml-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((i) => (
              <tr key={i}>
                <td><Skeleton className="h-4 w-48" /></td>
                <td className="text-center"><Skeleton className="h-5 w-10 mx-auto rounded-full" /></td>
                <td className="text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                <td className="text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                <td className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                <td className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PositionsEmptyState({ message }: { message: string }) {
  return (
    <div className="glass-card p-10 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--card)] mb-4">
        <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-[var(--foreground-muted)]" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
      </div>
      <p className="font-mono text-sm text-[var(--foreground-muted)] mb-4">{message}</p>
      <Link href="/markets" className="btn btn-primary">
        Browse Markets
      </Link>
    </div>
  );
}

/** Format a dollar amount with sign and color class */
function formatPnlDollar(value: number): { text: string; className: string } {
  const isPositive = value >= 0;
  return {
    text: `${isPositive ? '+' : '-'}$${Math.abs(value).toFixed(2)}`,
    className: isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]',
  };
}

function OpenPositionsTable({
  positions,
  loading,
}: {
  positions: EnrichedPosition[] | undefined;
  loading: boolean;
}) {
  if (loading) return <PositionsLoadingSkeleton />;
  if (!positions || positions.length === 0) {
    return <PositionsEmptyState message="No open positions yet." />;
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">Market</th>
              <th className="text-center w-16">Side</th>
              <th className="text-right w-20">Shares</th>
              <th className="text-right w-24">Avg Price</th>
              <th className="text-right w-28">Cost Basis</th>
              <th className="text-right w-24">Value</th>
              <th className="text-right w-28">Unrealized P&L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, i) => {
              const isYes = position.outcomeName.toLowerCase() === 'yes';
              const avgPrice = position.avg_price ?? 0;
              const costBasis = avgPrice * position.size;
              const currentValue = position.current_value ?? 0;
              const unrealizedPnl = position.unrealized_pnl ?? (currentValue - costBasis);
              const pnlPct = position.pnl_percent ?? (costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0);
              const pnlPositive = unrealizedPnl >= 0;
              const pnlDollar = formatPnlDollar(unrealizedPnl);
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
                      {(avgPrice * 100).toFixed(0)}c
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="font-mono text-sm text-[var(--foreground-muted)]">
                      ${costBasis.toFixed(2)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="font-mono text-sm font-bold">
                      ${currentValue.toFixed(2)}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className={`font-mono text-xs font-bold ${pnlDollar.className}`}
                      >
                        {pnlDollar.text}
                      </span>
                      <span
                        className={`font-mono text-[0.6rem] ${pnlPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
                      >
                        {pnlPositive ? '+' : ''}{pnlPct.toFixed(1)}%
                      </span>
                    </div>
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

function ResolvedPositionsTable({
  positions,
  loading,
}: {
  positions: EnrichedPosition[] | undefined;
  loading: boolean;
}) {
  if (loading) return <PositionsLoadingSkeleton />;
  if (!positions || positions.length === 0) {
    return <PositionsEmptyState message="No resolved positions yet." />;
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">Market</th>
              <th className="text-center w-16">Side</th>
              <th className="text-right w-24">Entry Price</th>
              <th className="text-right w-24">Resolution</th>
              <th className="text-right w-20">Outcome</th>
              <th className="text-right w-28">Realized P&L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, i) => {
              const isYes = position.outcomeName.toLowerCase() === 'yes';
              const avgPrice = position.avg_price ?? 0;
              const resolutionPrice = position.resolutionPrice;
              const realizedPnl = position.realized_pnl ?? 0;
              const pnlDollar = formatPnlDollar(realizedPnl);
              // Determine if the outcome was a win: resolution price is 1 for the winning side
              const isWin = resolutionPrice != null && resolutionPrice > 0.5;
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
                    <span className="font-mono text-sm text-[var(--foreground-muted)]">
                      {(avgPrice * 100).toFixed(0)}c
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="font-mono text-sm">
                      {resolutionPrice != null
                        ? `${(resolutionPrice * 100).toFixed(0)}c`
                        : '-'}
                    </span>
                  </td>
                  <td className="text-right">
                    {resolutionPrice != null ? (
                      <span
                        className={`tag ${isWin ? 'tag-success' : 'tag-danger'}`}
                      >
                        {isWin ? 'Won' : 'Lost'}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-[var(--foreground-muted)]">-</span>
                    )}
                  </td>
                  <td className="text-right">
                    <span
                      className={`font-mono text-sm font-bold ${pnlDollar.className}`}
                    >
                      {pnlDollar.text}
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
      <div className="glass-card overflow-hidden">
        <span className="sr-only">Loading activity...</span>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left w-16"><Skeleton className="h-3 w-10" /></th>
                <th className="text-left"><Skeleton className="h-3 w-10" /></th>
                <th className="text-right w-24"><Skeleton className="h-3 w-10 ml-auto" /></th>
                <th className="text-right w-24"><Skeleton className="h-3 w-12 ml-auto" /></th>
                <th className="text-right w-24"><Skeleton className="h-3 w-12 ml-auto" /></th>
                <th className="text-right w-36"><Skeleton className="h-3 w-20 ml-auto" /></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td><Skeleton className="h-5 w-12 rounded-full" /></td>
                  <td>
                    <Skeleton className="h-4 w-16 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </td>
                  <td className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                  <td className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></td>
                  <td className="text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                  <td className="text-right"><Skeleton className="h-3 w-28 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <div className="glass-card overflow-hidden">
        <span className="sr-only">Loading orders...</span>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left w-16"><Skeleton className="h-3 w-10" /></th>
                <th className="text-right w-20"><Skeleton className="h-3 w-12 ml-auto" /></th>
                <th className="text-right w-20"><Skeleton className="h-3 w-10 ml-auto" /></th>
                <th className="text-right w-20"><Skeleton className="h-3 w-12 ml-auto" /></th>
                <th className="text-right w-36"><Skeleton className="h-3 w-16 ml-auto" /></th>
                <th className="text-right w-20" />
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td><Skeleton className="h-5 w-12 rounded-full" /></td>
                  <td className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></td>
                  <td className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                  <td className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                  <td className="text-right"><Skeleton className="h-3 w-28 ml-auto" /></td>
                  <td className="text-right"><Skeleton className="h-7 w-16 ml-auto rounded-md" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
