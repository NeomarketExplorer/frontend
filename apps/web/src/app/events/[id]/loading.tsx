export default function Loading() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Back link */}
      <div className="h-4 w-28 bg-muted animate-pulse rounded" />

      {/* Event header card */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 sm:p-6">
        <div className="flex flex-col md:flex-row gap-5">
          {/* Image placeholder */}
          <div className="w-full md:w-40 h-40 bg-muted animate-pulse rounded shrink-0" />

          <div className="flex-1 space-y-4">
            {/* Status badge */}
            <div className="h-5 w-14 bg-muted animate-pulse rounded" />
            {/* Title */}
            <div className="h-8 w-2/3 bg-muted animate-pulse rounded" />
            {/* Description lines */}
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            </div>
            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="space-y-1">
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              </div>
              <div className="space-y-1">
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              </div>
              <div className="space-y-1">
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                <div className="h-4 w-8 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Markets section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-gradient-to-b from-[var(--success)] to-[var(--accent)] rounded-full" />
          <div className="h-6 w-24 bg-muted animate-pulse rounded" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 space-y-2">
                  {/* Market question */}
                  <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
                  {/* Volume */}
                  <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                </div>
                {/* Outcome badges */}
                <div className="flex gap-2">
                  <div className="w-[70px] h-12 bg-muted animate-pulse rounded" />
                  <div className="w-[70px] h-12 bg-muted animate-pulse rounded" />
                </div>
              </div>
              {/* Price bar */}
              <div className="mt-3 h-1 bg-muted animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
