import { Skeleton, LoadingRegion, SkeletonCard } from "@/components/ui/Skeleton";

// Radar is a 3-column kanban — mirror its control bar, summary strip and columns.
export default function RadarLoading() {
  return (
    <LoadingRegion label="Loading radar">
      {/* control bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-7 w-56" />
      </div>
      {/* summary strip */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      {/* columns */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, col) => (
          <div
            key={col}
            className="rounded-lg bg-surface p-2"
            style={{ border: "0.5px solid var(--border)" }}
          >
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} lines={2} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
