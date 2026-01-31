'use client';

import { AuthGuard } from '@/components/auth-guard';
import { ConnectButton } from '@/components/connect-button';
import { useAuth } from '@/hooks/use-auth';
import { useWalletStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@app/ui';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage how you sign in and which wallets are linked.
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Accounts</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Account linking controls will live here. Use the wallet menu to switch accounts for now.
        </CardContent>
      </Card>
    </div>
  );
}
