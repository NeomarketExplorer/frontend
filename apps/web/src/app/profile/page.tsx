'use client';

import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { ConnectButton } from '@/components/connect-button';
import { useAuth } from '@/hooks/use-auth';
import { useUserStats } from '@/hooks/use-clickhouse';
import { formatVolume } from '@/lib/indexer';
import { useWalletStore } from '@/stores';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@app/ui';
import type { UserStats } from '@/lib/clickhouse';

export default function ProfilePage() {
  return (
    <AuthGuard
      title="Profile"
      description="Connect your account to view profile details."
      fallback={<ProfileConnectPrompt />}
    >
      <ProfileContent />
    </AuthGuard>
  );
}

function ProfileConnectPrompt() {
  return (
    <div className="py-12">
      <div className="text-center max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-3">Profile</h1>
        <p className="text-muted-foreground mb-6">
          Connect your account to view profile details.
        </p>
        <ConnectButton />
      </div>
    </div>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  const address = useWalletStore((state) => state.address);
  const { data: stats, isLoading } = useUserStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account and trading statistics.
        </p>
      </div>

      {/* Account Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Wallet</span>
            <span className="font-mono">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{user?.email?.address ?? 'Not linked'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={address ? 'positive' : 'secondary'}>
              {address ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Trading Stats */}
      <TradingStats stats={stats} isLoading={isLoading} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trading Stats
// ---------------------------------------------------------------------------

interface TradingStatsProps {
  stats: UserStats | undefined;
  isLoading: boolean;
}

function TradingStats({ stats, isLoading }: TradingStatsProps) {
  if (isLoading) {
    return <TradingStatsSkeleton />;
  }

  if (!stats || stats.totalTrades === 0) {
    return <TradingStatsEmpty />;
  }

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="glass-card p-5">
        <h2 className="font-mono text-xs text-[var(--foreground-muted)] uppercase tracking-wider mb-4">
          Trading Stats
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem label="Total Trades" value={String(stats.totalTrades)} />
          <StatItem label="Total Volume" value={formatVolume(stats.totalVolume)} />
          <StatItem label="Markets Traded" value={String(stats.marketsTraded)} />
          <StatItem
            label="Avg Trade Size"
            value={`$${stats.avgTradeSize.toFixed(2)}`}
          />
          <WinRateItem winRate={stats.winRate} />
          <PnlItem label="Realized P&L" value={stats.totalRealizedPnl} />
          <StatItem
            label="Member Since"
            value={formatDate(stats.firstTradeAt)}
          />
          <StatItem
            label="Last Active"
            value={formatRelativeTime(stats.lastTradeAt)}
          />
        </div>
      </div>

      {/* Best / Worst Trade */}
      {(stats.bestTrade || stats.worstTrade) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.bestTrade && (
            <TradeHighlight
              label="Best Trade"
              market={stats.bestTrade.market}
              conditionId={stats.bestTrade.conditionId}
              pnl={stats.bestTrade.pnl}
              variant="positive"
            />
          )}
          {stats.worstTrade && (
            <TradeHighlight
              label="Worst Trade"
              market={stats.worstTrade.market}
              conditionId={stats.worstTrade.conditionId}
              pnl={stats.worstTrade.pnl}
              variant="negative"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Items
// ---------------------------------------------------------------------------

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="font-mono font-bold text-lg">{value}</p>
    </div>
  );
}

function WinRateItem({ winRate }: { winRate: number | null }) {
  const hasWinRate = winRate != null;
  const percentage = hasWinRate ? Math.round(winRate * 100) : 0;

  return (
    <div>
      <p className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider mb-1">
        Win Rate
      </p>
      {hasWinRate ? (
        <div className="space-y-1.5">
          <p className="font-mono font-bold text-lg">{percentage}%</p>
          <div className="h-1.5 w-full bg-[var(--card)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="font-mono font-bold text-lg text-[var(--foreground-muted)]">
          N/A
        </p>
      )}
    </div>
  );
}

function PnlItem({ label, value }: { label: string; value: number | null }) {
  if (value == null) {
    return (
      <div>
        <p className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="font-mono font-bold text-lg text-[var(--foreground-muted)]">
          N/A
        </p>
      </div>
    );
  }

  const isPositive = value >= 0;
  const color = isPositive ? 'var(--success)' : 'var(--danger)';
  const sign = isPositive ? '+' : '-';
  const formatted = `${sign}$${Math.abs(value).toFixed(2)}`;

  return (
    <div>
      <p className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="font-mono font-bold text-lg" style={{ color }}>
        {formatted}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trade Highlight Cards
// ---------------------------------------------------------------------------

interface TradeHighlightProps {
  label: string;
  market: string;
  conditionId: string;
  pnl: number;
  variant: 'positive' | 'negative';
}

function TradeHighlight({ label, market, conditionId, pnl, variant }: TradeHighlightProps) {
  const isPositive = variant === 'positive';
  const color = isPositive ? 'var(--success)' : 'var(--danger)';
  const sign = pnl >= 0 ? '+' : '-';
  const formattedPnl = `${sign}$${Math.abs(pnl).toFixed(2)}`;

  const content = (
    <div className="glass-card p-4 group hover:border-[var(--accent)]/30 transition-colors">
      <p className="font-mono text-[0.6rem] text-[var(--foreground-muted)] uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-sm font-medium line-clamp-2 mb-2 group-hover:text-[var(--accent)] transition-colors">
        {market}
      </p>
      <p className="font-mono font-bold text-lg" style={{ color }}>
        {formattedPnl}
      </p>
    </div>
  );

  if (conditionId) {
    return (
      <Link href={`/market/${conditionId}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

// ---------------------------------------------------------------------------
// Loading & Empty States
// ---------------------------------------------------------------------------

function TradingStatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <Skeleton className="h-3 w-24 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <Skeleton className="h-2.5 w-16 mb-3" />
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-7 w-20" />
        </div>
        <div className="glass-card p-4">
          <Skeleton className="h-2.5 w-16 mb-3" />
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>
    </div>
  );
}

function TradingStatsEmpty() {
  return (
    <div className="glass-card p-10 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--card)] mb-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-7 h-7 text-[var(--foreground-muted)]"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
      </div>
      <p className="font-mono text-sm text-[var(--foreground-muted)] mb-4">
        No trading activity yet.
      </p>
      <Link href="/markets" className="btn btn-primary">
        Browse Markets
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: number): string {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'N/A';

  const now = Date.now();
  const diff = now - timestamp * 1000;

  if (diff < 0) return 'just now';

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
