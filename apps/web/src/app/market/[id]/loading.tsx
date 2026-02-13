export default function Loading() {
  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--card-border)] bg-[var(--background-secondary)]/50">
        <div className="w-8 h-8 bg-muted animate-pulse rounded" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
          <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-6 w-16 bg-muted animate-pulse rounded" />
        <div className="flex gap-0.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-7 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>

      {/* Body — 2 column layout */}
      <div className="flex-1 flex">
        {/* Left: Chart (~65%) */}
        <div className="flex-[65] bg-muted/20 animate-pulse" />

        {/* Right column (~35%) */}
        <div className="flex-[35] border-l border-[var(--card-border)] flex flex-col">
          {/* Orderbook skeleton */}
          <div className="flex-[45] p-3 space-y-1.5 border-b border-[var(--card-border)]">
            <div className="h-4 w-20 bg-muted animate-pulse rounded mb-3" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3.5 w-12 bg-muted animate-pulse rounded" />
                <div className="h-3.5 w-10 bg-muted animate-pulse rounded" />
              </div>
            ))}
            <div className="py-1.5 flex justify-center">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3.5 w-12 bg-muted animate-pulse rounded" />
                <div className="h-3.5 w-10 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>

          {/* Trade panel skeleton */}
          <div className="flex-[55] p-3 space-y-3">
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-2 gap-1">
              <div className="h-8 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted animate-pulse rounded" />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="h-8 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-8 w-full bg-muted animate-pulse rounded" />
            <div className="h-8 w-full bg-muted animate-pulse rounded" />
            <div className="h-10 w-full bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>

      {/* Bottom tabs skeleton */}
      <div className="h-[25%] border-t border-[var(--card-border)] p-3 space-y-2">
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-muted animate-pulse rounded" />
          <div className="h-6 w-16 bg-muted animate-pulse rounded" />
          <div className="h-6 w-16 bg-muted animate-pulse rounded" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-10 bg-muted animate-pulse rounded" />
            <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
            <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
            <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
