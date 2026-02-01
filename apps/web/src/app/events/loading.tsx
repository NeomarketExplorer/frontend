export default function Loading() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-6 bg-gradient-to-b from-[var(--accent)] to-[var(--success)] rounded-full" />
                <div className="h-8 w-32 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-4 w-64 bg-muted animate-pulse rounded" />
            </div>
            {/* Search bar skeleton */}
            <div className="h-10 w-full sm:w-72 bg-[var(--card)] border border-[var(--card-border)] rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        <div className="h-8 w-12 bg-muted animate-pulse rounded" />
      </div>

      {/* Event cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg overflow-hidden"
          >
            {/* Image placeholder */}
            <div className="h-32 bg-muted animate-pulse" />
            <div className="p-4 space-y-3">
              {/* Title */}
              <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
              {/* Subtitle */}
              <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
              {/* Stats row */}
              <div className="flex items-center gap-3 pt-1">
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
