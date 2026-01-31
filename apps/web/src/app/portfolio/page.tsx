'use client';

import Link from 'next/link';
import { ConnectButton } from '@/components/connect-button';
import { AuthGuard } from '@/components/auth-guard';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@app/ui';
import { usePortfolio, usePositions, useActivity } from '@/hooks';
import { useWalletStore } from '@/stores';

export default function PortfolioPage() {
  const { isConnected, address } = useWalletStore();
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
    <div className="py-12">
      <div className="text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-3">Portfolio</h1>
        <p className="text-muted-foreground mb-6">
          Connect your wallet to view your positions, P&L, and trade history.
        </p>
        <ConnectButton />
      </div>
    </div>
  );
}

function PortfolioContent({
  address,
  portfolio,
  portfolioLoading,
  positions,
  positionsLoading,
  activity,
  activityLoading,
}: {
  address: string;
  portfolio: ReturnType<typeof usePortfolio>['data'];
  portfolioLoading: boolean;
  positions: ReturnType<typeof usePositions>['data'];
  positionsLoading: boolean;
  activity: ReturnType<typeof useActivity>['data'];
  activityLoading: boolean;
}) {

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        {address && (
          <div className="text-sm text-muted-foreground font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
        )}
      </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Portfolio Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {portfolioLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  `$${portfolio?.totalValue.toFixed(2) ?? '0.00'}`
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total P&L
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(portfolio?.totalPnL ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                {portfolioLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  `${(portfolio?.totalPnL ?? 0) >= 0 ? '+' : ''}$${portfolio?.totalPnL?.toFixed(2) ?? '0.00'}`
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {positionsLoading ? (
                  <div className="h-8 w-12 bg-muted animate-pulse rounded" />
                ) : (
                  positions?.length ?? 0
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {positionsLoading ? (
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                ) : (
                  positions && positions.length > 0
                    ? `${((positions.filter(p => (p.pnl ?? 0) > 0).length / positions.length) * 100).toFixed(0)}%`
                    : '-'
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="positions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="mt-0">
            {positionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-4">
                      <div className="animate-pulse flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="h-5 w-48 bg-muted rounded" />
                          <div className="h-4 w-32 bg-muted rounded" />
                        </div>
                        <div className="space-y-2 text-right">
                          <div className="h-5 w-20 bg-muted rounded ml-auto" />
                          <div className="h-5 w-16 bg-muted rounded ml-auto" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : positions?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No open positions yet.</p>
                  <Link href="/markets">
                    <Button>Browse Markets</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {positions?.map((position, i) => (
                  <Link key={i} href={`/market/${position.condition_id}`}>
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                                {position.outcome_index === 0 ? 'YES' : 'NO'}
                              </span>
                              <span className="text-muted-foreground">
                                {position.condition_id.slice(0, 8)}...{position.condition_id.slice(-6)}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {position.size.toFixed(2)} shares @ {((position.avg_price ?? 0) * 100).toFixed(0)}¢
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              ${position.current_value?.toFixed(2) ?? '0.00'}
                            </div>
                            <Badge variant={(position.pnl ?? 0) >= 0 ? 'positive' : 'negative'}>
                              {(position.pnl ?? 0) >= 0 ? '+' : ''}{position.pnl_percent?.toFixed(1) ?? '0'}%
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            {activityLoading ? (
              <Card>
                <CardContent className="py-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-12 bg-muted rounded" />
                        <div className="h-4 w-32 bg-muted rounded" />
                      </div>
                      <div className="h-4 w-24 bg-muted rounded" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : activity?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No trading activity yet.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-2">
                  <div className="divide-y">
                    {activity?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <Badge variant={item.side === 'BUY' ? 'positive' : 'negative'} className="w-14 justify-center">
                            {item.side ?? item.type.toUpperCase()}
                          </Badge>
                          <div>
                            <div className="text-sm font-medium capitalize">{item.type}</div>
                            {item.size && item.price && (
                              <div className="text-xs text-muted-foreground">
                                {item.size.toFixed(2)} shares @ {(item.price * 100).toFixed(0)}¢
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {item.value && (
                            <div className="text-sm font-medium">
                              ${item.value.toFixed(2)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}
