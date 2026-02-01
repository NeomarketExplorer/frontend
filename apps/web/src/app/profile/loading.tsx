export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-8 w-24 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded" />
      </div>

      {/* Account card */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
        <div className="p-4 border-b border-[var(--card-border)]">
          <div className="h-5 w-20 bg-muted animate-pulse rounded" />
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-14 bg-muted animate-pulse rounded" />
            <div className="h-4 w-28 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
            <div className="h-4 w-36 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-14 bg-muted animate-pulse rounded" />
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>

      {/* Linked Accounts card */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
        <div className="p-4 border-b border-[var(--card-border)]">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="p-4">
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
