// Loading-skeleton primitives for route-level loading.tsx fallbacks. Purely
// decorative: the shimmer blocks are aria-hidden and each fallback wraps them in
// a role="status" region with an sr-only "Loading…" so assistive tech is told a
// load is in progress without reading the placeholder shapes.

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`block animate-pulse rounded bg-[#E9E7E0] ${className}`}
      style={style}
      aria-hidden
    />
  );
}

// Wraps a route skeleton with the polite live-region announcement.
export function LoadingRegion({
  label = "Loading",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

// A card-shaped placeholder (title + a few lines), used across grid skeletons.
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="rounded-lg bg-surface p-4"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <Skeleton className="h-4 w-1/2" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

// A responsive grid of card placeholders.
export function SkeletonCardGrid({
  count = 6,
  lines = 3,
}: {
  count?: number;
  lines?: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}

// A standard page skeleton: a title block + a card grid. Most routes use this.
export function PageSkeleton({
  cards = 6,
  lines = 3,
}: {
  cards?: number;
  lines?: number;
}) {
  return (
    <LoadingRegion>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-3 w-72" />
      <div className="mt-6">
        <SkeletonCardGrid count={cards} lines={lines} />
      </div>
    </LoadingRegion>
  );
}
