export default function Loading() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="h-4 w-28 bg-muted animate-pulse rounded" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4"
          >
            <div className="h-4 w-24 bg-muted animate-pulse rounded mb-3" />
            <div className="h-8 w-20 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-9 w-24 bg-muted animate-pulse rounded" />
        <div className="h-9 w-20 bg-muted animate-pulse rounded" />
        <div className="h-9 w-18 bg-muted animate-pulse rounded" />
      </div>

      {/* Position cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-12 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-48 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
              <div className="space-y-2 text-right">
                <div className="h-5 w-20 bg-muted animate-pulse rounded ml-auto" />
                <div className="h-5 w-16 bg-muted animate-pulse rounded ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
